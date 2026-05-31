from dataclasses import dataclass, field
from datetime import date
from uuid import UUID, uuid4


@dataclass(frozen=True)
class Job:
    title: str
    company: str
    location: str
    description: str
    required_skills: frozenset[str]
    url: str
    source: str = "mock"
    external_id: str | None = None
    posted_at: date | None = None
    salary: str | None = None
    work_mode: str = "Remote"
    id: UUID = field(default_factory=uuid4)


@dataclass(frozen=True)
class JobMatch:
    job: Job
    match_score: int
    matching_skills: tuple[str, ...]
    missing_skills: tuple[str, ...]
    experience_match: int

