from datetime import date
from uuid import NAMESPACE_URL, uuid5

import httpx

from app.application.resumes.service import detect_skills
from app.domain.jobs.entities import Job


class AdzunaJobProvider:
    def __init__(
        self,
        app_id: str,
        app_key: str,
        country: str = "in",
        results_per_page: int = 20,
        timeout_seconds: float = 10,
    ) -> None:
        self._app_id = app_id
        self._app_key = app_key
        self._country = country
        self._results_per_page = results_per_page
        self._timeout_seconds = timeout_seconds

    def search_jobs(self, query: str = "") -> list[Job]:
        response = httpx.get(
            f"https://api.adzuna.com/v1/api/jobs/{self._country}/search/1",
            params={
                "app_id": self._app_id,
                "app_key": self._app_key,
                "results_per_page": self._results_per_page,
                "what": query.strip(),
                "content-type": "application/json",
            },
            headers={"Accept": "application/json"},
            timeout=self._timeout_seconds,
        )
        response.raise_for_status()
        return [to_job(result) for result in response.json().get("results", [])]


def to_job(result: dict) -> Job:
    external_id = str(result["id"])
    description = str(result.get("description", ""))
    return Job(
        id=uuid5(NAMESPACE_URL, f"jobcopilot:adzuna:{external_id}"),
        external_id=external_id,
        source="adzuna",
        title=str(result.get("title", "Untitled role")),
        company=str(result.get("company", {}).get("display_name", "Unknown company")),
        location=str(result.get("location", {}).get("display_name", "Location not provided")),
        description=description,
        required_skills=frozenset(skill for skill, _ in detect_skills(description)),
        url=str(result.get("redirect_url", "")),
        posted_at=parse_date(result.get("created")),
        salary=format_salary(result.get("salary_min"), result.get("salary_max")),
        work_mode="Not specified",
    )


def parse_date(value: object) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def format_salary(minimum: object, maximum: object) -> str | None:
    if not isinstance(minimum, (int, float)) and not isinstance(maximum, (int, float)):
        return None
    values = [f"₹{round(value):,}" for value in (minimum, maximum) if isinstance(value, (int, float))]
    return " - ".join(values)
