from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

import httpx

from app.application.retry import RetryPolicy, run_with_retries
from app.domain.jobs.entities import Job


class JobProvider(Protocol):
    name: str

    def search_jobs(self, query: str = "", location: str = "") -> list[Job]: ...


@dataclass
class ProviderHealth:
    name: str
    status: str = "configured"
    last_checked_at: datetime | None = None
    last_result_count: int | None = None
    retry_attempts: int = 0
    last_error: str | None = None


class AggregateJobProvider:
    def __init__(self, providers: list[JobProvider], retry_policy: RetryPolicy | None = None) -> None:
        self._providers = providers
        self._health = {provider.name: ProviderHealth(name=provider.name) for provider in providers}
        self._retry_policy = retry_policy or RetryPolicy(max_attempts=2, base_delay_seconds=0.2, max_delay_seconds=1)

    def search_jobs(self, query: str = "", location: str = "") -> list[Job]:
        jobs: list[Job] = []
        errors: list[httpx.HTTPError] = []
        for provider in self._providers:
            health = self._health[provider.name]
            health.last_checked_at = datetime.now(timezone.utc)
            result = run_with_retries(lambda provider=provider: provider.search_jobs(query, location), (httpx.HTTPError,), self._retry_policy)
            health.retry_attempts = result.attempts
            if result.value is None:
                health.status = "unavailable"
                health.last_result_count = None
                health.last_error = result.error.__class__.__name__ if result.error else "ProviderError"
                if isinstance(result.error, httpx.HTTPError):
                    errors.append(result.error)
                continue
            results = result.value
            health.status = "available"
            health.last_result_count = len(results)
            health.last_error = None
            jobs.extend(results)
        if errors and not jobs:
            raise errors[0]
        return deduplicate_jobs(jobs)

    def health(self) -> list[ProviderHealth]:
        return list(self._health.values())


def deduplicate_jobs(jobs: list[Job]) -> list[Job]:
    unique: dict[tuple[str, str, str], Job] = {}
    for job in jobs:
        key = (job.title.strip().lower(), job.company.strip().lower(), job.location.strip().lower())
        unique.setdefault(key, job)
    return list(unique.values())
