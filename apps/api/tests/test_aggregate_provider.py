from dataclasses import dataclass

import httpx

from app.application.retry import RetryPolicy
from app.domain.jobs.entities import Job
from app.infrastructure.providers.aggregate_jobs import AggregateJobProvider


@dataclass
class StubProvider:
    name: str
    jobs: list[Job] | None = None
    failures_before_success: int = 0
    calls: int = 0

    def search_jobs(self, query: str = "", location: str = "") -> list[Job]:
        self.calls += 1
        if self.failures_before_success and self.calls <= self.failures_before_success:
            raise httpx.ConnectError("provider temporarily unavailable")
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
    assert [item.retry_attempts for item in health] == [1, 1]


def test_aggregate_provider_returns_partial_results_when_one_provider_fails() -> None:
    job = Job(title="Python Engineer", company="Example", location="Remote", description="Python", required_skills=frozenset({"python"}), url="https://example.com")
    provider = AggregateJobProvider([StubProvider("down"), StubProvider("up", [job])], retry_policy=RetryPolicy(max_attempts=2, base_delay_seconds=0))

    assert provider.search_jobs() == [job]
    health = provider.health()
    assert [item.status for item in health] == ["unavailable", "available"]
    assert health[0].retry_attempts == 2
    assert health[0].last_error == "ConnectError"


def test_aggregate_provider_retries_transient_provider_failure() -> None:
    job = Job(title="Python Engineer", company="Example", location="Remote", description="Python", required_skills=frozenset({"python"}), url="https://example.com")
    flaky = StubProvider("flaky", [job], failures_before_success=1)
    provider = AggregateJobProvider([flaky], retry_policy=RetryPolicy(max_attempts=2, base_delay_seconds=0))

    assert provider.search_jobs() == [job]
    assert flaky.calls == 2
    assert provider.health()[0].retry_attempts == 2
    assert provider.health()[0].last_error is None


def test_aggregate_provider_raises_when_all_providers_fail() -> None:
    provider = AggregateJobProvider([StubProvider("down")])

    try:
        provider.search_jobs()
    except httpx.HTTPError:
        pass
    else:
        raise AssertionError("Expected provider failure.")
