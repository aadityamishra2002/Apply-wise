from datetime import date, datetime, timezone
from html import unescape
import re
from uuid import NAMESPACE_URL, uuid5

import httpx

from app.application.resumes.service import detect_skills
from app.domain.jobs.entities import Job


class RemotiveJobProvider:
    name = "remotive"

    def __init__(
        self,
        results_limit: int = 20,
        timeout_seconds: float = 10,
        cache_minutes: int = 15,
    ) -> None:
        self._results_limit = results_limit
        self._timeout_seconds = timeout_seconds
        self._cache_seconds = max(cache_minutes, 0) * 60
        self._cache: dict[tuple[str, str], tuple[datetime, list[Job]]] = {}

    def search_jobs(self, query: str = "", location: str = "") -> list[Job]:
        cache_key = (query.strip().lower(), location.strip().lower())
        cached = self._cache.get(cache_key)
        now = datetime.now(timezone.utc)
        if cached and (now - cached[0]).total_seconds() < self._cache_seconds:
            return cached[1]

        response = httpx.get(
            "https://remotive.com/api/remote-jobs",
            params={"search": query.strip()} if query.strip() else {},
            headers={
                "Accept": "application/json",
                "User-Agent": "ApplyWise/1.0 (https://apply-wise-1.vercel.app)",
            },
            timeout=self._timeout_seconds,
        )
        response.raise_for_status()
        jobs = [to_job(result) for result in response.json().get("jobs", [])]
        jobs = filter_by_location(jobs, location)[: self._results_limit]
        self._cache[cache_key] = (now, jobs)
        return jobs


def to_job(result: dict) -> Job:
    external_id = str(result.get("id") or result.get("url") or result.get("title", "unknown"))
    description = clean_text(result.get("description", ""))
    tags = [str(tag) for tag in result.get("tags", []) if tag]
    searchable_text = f"{description} {' '.join(tags)}"
    return Job(
        id=uuid5(NAMESPACE_URL, f"jobcopilot:remotive:{external_id}"),
        external_id=external_id,
        source="remotive",
        title=str(result.get("title") or "Untitled remote role"),
        company=str(result.get("company_name") or "Unknown company"),
        location=str(result.get("candidate_required_location") or "Remote"),
        description=description,
        required_skills=frozenset(skill for skill, _ in detect_skills(searchable_text)),
        url=str(result.get("url") or "https://remotive.com/remote-jobs"),
        posted_at=parse_date(result.get("publication_date")),
        salary=format_salary(result.get("salary")),
        work_mode="Remote",
    )


def clean_text(value: object) -> str:
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    return re.sub(r"\s+", " ", unescape(text)).strip()


def parse_date(value: object) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def format_salary(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    salary = value.strip()
    return salary or None


def filter_by_location(jobs: list[Job], location: str) -> list[Job]:
    requested = location.strip().lower()
    if not requested:
        return jobs
    remote_anywhere = {"remote", "worldwide", "anywhere"}
    filtered = [
        job
        for job in jobs
        if requested in job.location.lower() or job.location.strip().lower() in remote_anywhere
    ]
    return filtered or jobs
