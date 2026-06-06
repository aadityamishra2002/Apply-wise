from app.application.retry import RetryPolicy, run_with_retries


def test_run_with_retries_succeeds_after_retry() -> None:
    attempts = {"count": 0}

    def operation() -> str:
        attempts["count"] += 1
        if attempts["count"] < 2:
            raise TimeoutError("temporary")
        return "ok"

    result = run_with_retries(operation, (TimeoutError,), RetryPolicy(max_attempts=3, base_delay_seconds=0))

    assert result.value == "ok"
    assert result.attempts == 2
    assert result.error is None


def test_run_with_retries_returns_last_error_after_exhaustion() -> None:
    result = run_with_retries(
        lambda: (_ for _ in ()).throw(TimeoutError("still down")),
        (TimeoutError,),
        RetryPolicy(max_attempts=2, base_delay_seconds=0),
    )

    assert result.value is None
    assert result.attempts == 2
    assert isinstance(result.error, TimeoutError)
