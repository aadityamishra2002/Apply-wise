from app.core.rate_limit import InMemoryRateLimiter, is_sensitive_path


def test_rate_limiter_blocks_after_limit_and_reports_retry_after() -> None:
    limiter = InMemoryRateLimiter(window_seconds=60, default_limit=3, sensitive_limit=2)

    first = limiter.check("user:/api/v1/auth/login", sensitive=True, now=100)
    second = limiter.check("user:/api/v1/auth/login", sensitive=True, now=101)
    blocked = limiter.check("user:/api/v1/auth/login", sensitive=True, now=102)

    assert first.allowed
    assert second.allowed
    assert not blocked.allowed
    assert blocked.limit == 2
    assert blocked.retry_after_seconds == 58


def test_rate_limiter_sliding_window_expires_old_hits() -> None:
    limiter = InMemoryRateLimiter(window_seconds=10, default_limit=1, sensitive_limit=1)

    assert limiter.check("client:/api/v1/jobs", sensitive=False, now=100).allowed
    assert not limiter.check("client:/api/v1/jobs", sensitive=False, now=105).allowed
    assert limiter.check("client:/api/v1/jobs", sensitive=False, now=111).allowed


def test_sensitive_path_detection() -> None:
    assert is_sensitive_path("/api/v1/auth/login")
    assert is_sensitive_path("/api/v1/extension/jobs/capture")
    assert is_sensitive_path("/api/v1/resumes/upload")
    assert is_sensitive_path("/api/v1/applications/abc/prepare")
    assert not is_sensitive_path("/api/v1/jobs")
