from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from time import monotonic


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    retry_after_seconds: int


class InMemoryRateLimiter:
    """Small per-process sliding-window limiter.

    This protects sensitive MVP endpoints without adding an external dependency.
    In multi-replica production, replace this with Redis-backed counters.
    """

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
