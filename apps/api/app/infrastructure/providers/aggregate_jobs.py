from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

import httpx

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


class AggregateJobProvider:
    def __init__(self, providers: list[JobProvider]) -> None:
        self._providers = providers
        self._health = {provider.name: ProviderHealth(name=provider.name) for provider in providers}

    def search_jobs(self, query: str = "", location: str = "") -> list[Job]:
        jobs: list[Job] = []
        errors: list[httpx.HTTPError] = []
        for provider in self._providers:
            health = self._health[provider.name]
            health.last_checked_at = datetime.now(timezone.utc)
            try:
                results = provider.search_jobs(query, location)
            except httpx.HTTPError as error:
                health.status = "unavailable"
                health.last_result_count = None
                errors.append(error)
                continue
            health.status = "available"
            health.last_result_count = len(results)
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
