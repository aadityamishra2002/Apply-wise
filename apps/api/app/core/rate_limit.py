from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from hashlib import sha256
from time import monotonic

from redis.asyncio import Redis

from app.core.config import get_settings


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    retry_after_seconds: int


class InMemoryRateLimiter:
    """Small per-process sliding-window limiter retained for focused tests."""

    def __init__(self, window_seconds: int, default_limit: int, sensitive_limit: int) -> None:
        self.window_seconds = window_seconds
        self.default_limit = default_limit
        self.sensitive_limit = sensitive_limit
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, *, sensitive: bool, now: float | None = None) -> RateLimitResult:
        timestamp = monotonic() if now is None else now
        limit = self.sensitive_limit if sensitive else self.default_limit
        hits = self._hits[key]
        cutoff = timestamp - self.window_seconds

        while hits and hits[0] <= cutoff:
            hits.popleft()

        if len(hits) >= limit:
            retry_after = max(1, int(self.window_seconds - (timestamp - hits[0])))
            return RateLimitResult(
                allowed=False,
                limit=limit,
                remaining=0,
                retry_after_seconds=retry_after,
            )

        hits.append(timestamp)
        return RateLimitResult(
            allowed=True,
            limit=limit,
            remaining=max(limit - len(hits), 0),
            retry_after_seconds=0,
        )


class RedisRateLimiter:
    """Shared fixed-window limiter for API replicas."""

    _INCREMENT_SCRIPT = """
    local count = redis.call('INCR', KEYS[1])
    if count == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
    end
    return {count, redis.call('TTL', KEYS[1])}
    """

    def __init__(
        self,
        client: Redis,
        window_seconds: int,
        default_limit: int,
        sensitive_limit: int,
    ) -> None:
        self.client = client
        self.window_seconds = window_seconds
        self.default_limit = default_limit
        self.sensitive_limit = sensitive_limit

    async def check(self, key: str, *, sensitive: bool) -> RateLimitResult:
        limit = self.sensitive_limit if sensitive else self.default_limit
        redis_key = "rate-limit:" + sha256(key.encode("utf-8")).hexdigest()
        count, ttl = await self.client.eval(
            self._INCREMENT_SCRIPT,
            1,
            redis_key,
            self.window_seconds,
        )
        count = int(count)
        return RateLimitResult(
            allowed=count <= limit,
            limit=limit,
            remaining=max(limit - count, 0),
            retry_after_seconds=max(int(ttl), 1) if count > limit else 0,
        )

    async def ping(self) -> bool:
        return bool(await self.client.ping())

    async def close(self) -> None:
        await self.client.aclose()


SENSITIVE_PATH_PREFIXES = (
    "/api/v1/auth",
    "/api/v1/extension",
    "/api/v1/resumes/upload",
)

SENSITIVE_PATH_KEYWORDS = (
    "/prepare",
    "/tailor",
    "/cover-letter",
    "/download",
)


def is_sensitive_path(path: str) -> bool:
    return path.startswith(SENSITIVE_PATH_PREFIXES) or any(keyword in path for keyword in SENSITIVE_PATH_KEYWORDS)


settings = get_settings()
redis_client = Redis.from_url(
    settings.redis_url,
    socket_connect_timeout=2,
    socket_timeout=2,
)
rate_limiter = RedisRateLimiter(
    client=redis_client,
    window_seconds=settings.rate_limit_window_seconds,
    default_limit=settings.rate_limit_default_requests,
    sensitive_limit=settings.rate_limit_sensitive_requests,
)
