from dataclasses import dataclass

import httpx

from app.domain.jobs.entities import Job
from app.infrastructure.providers.aggregate_jobs import AggregateJobProvider


@dataclass
class StubProvider:
    name: str
    jobs: list[Job] | None = None

    def search_jobs(self, query: str = "", location: str = "") -> list[Job]:
        if self.jobs is None:
            raise httpx.ConnectError("provider unavailable")
        return self.jobs


def test_aggregate_provider_deduplicates_jobs_and_reports_health() -> None:
    job = Job(title="Python Engineer", company="Example", location="Remote", description="Python", required_skills=frozenset({"python"}), url="https://example.com")
    provider = AggregateJobProvider([StubProvider("one", [job]), StubProvider("two", [job])])

    assert provider.search_jobs("python") == [job]
    health = provider.health()
    assert [item.status for item in health] == ["available", "available"]
    assert [item.last_result_count for item in health] == [1, 1]


def test_aggregate_provider_returns_partial_results_when_one_provider_fails() -> None:
    job = Job(title="Python Engineer", company="Example", location="Remote", description="Python", required_skills=frozenset({"python"}), url="https://example.com")
    provider = AggregateJobProvider([StubProvider("down"), StubProvider("up", [job])])

    assert provider.search_jobs() == [job]
    assert [item.status for item in provider.health()] == ["unavailable", "available"]


def test_aggregate_provider_raises_when_all_providers_fail() -> None:
    provider = AggregateJobProvider([StubProvider("down")])

    try:
        provider.search_jobs()
    except httpx.HTTPError:
        pass
    else:
        raise AssertionError("Expected provider failure.")
