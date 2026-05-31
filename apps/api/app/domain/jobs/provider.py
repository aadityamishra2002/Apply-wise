from typing import Protocol

from app.domain.jobs.entities import Job


class JobProvider(Protocol):
    def search_jobs(self, query: str = "") -> list[Job]:
        ...

