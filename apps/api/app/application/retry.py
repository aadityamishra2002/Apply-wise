from collections.abc import Callable
from dataclasses import dataclass
import time
from typing import TypeVar


T = TypeVar("T")


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 3
    base_delay_seconds: float = 0.25
    max_delay_seconds: float = 2


@dataclass(frozen=True)
class RetryResult[T]:
    value: T | None
    attempts: int
    error: Exception | None = None


def run_with_retries(operation: Callable[[], T], retryable: tuple[type[Exception], ...], policy: RetryPolicy) -> RetryResult[T]:
    attempts = max(1, policy.max_attempts)
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return RetryResult(value=operation(), attempts=attempt)
        except retryable as error:
            last_error = error
            if attempt == attempts:
                break
            delay = min(policy.base_delay_seconds * (2 ** (attempt - 1)), policy.max_delay_seconds)
            if delay > 0:
                time.sleep(delay)
    return RetryResult(value=None, attempts=attempts, error=last_error)
