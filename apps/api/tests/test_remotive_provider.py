import httpx

from app.infrastructure.providers.remotive_jobs import RemotiveJobProvider


def test_remotive_provider_maps_remote_jobs(monkeypatch) -> None:
    calls: list[dict] = []

    def fake_get(url: str, params: dict, headers: dict, timeout: float) -> httpx.Response:
        calls.append({"url": url, "params": params, "headers": headers, "timeout": timeout})
        return httpx.Response(
            200,
            json={
                "jobs": [
                    {
                        "id": 123,
                        "title": "Remote Python Engineer",
                        "company_name": "Example Remote",
                        "candidate_required_location": "Worldwide",
                        "description": "<p>Build Python and React services.</p>",
                        "url": "https://remotive.com/remote-jobs/software-dev/python-engineer",
                        "publication_date": "2026-06-01T10:00:00Z",
                        "salary": "$80k - $120k",
                        "tags": ["Python", "React"],
                    }
                ]
            },
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(httpx, "get", fake_get)
    provider = RemotiveJobProvider(results_limit=10, timeout_seconds=5, cache_minutes=15)

    jobs = provider.search_jobs("python", "remote")

    assert calls == [
        {
            "url": "https://remotive.com/api/remote-jobs",
            "params": {"search": "python"},
            "headers": {
                "Accept": "application/json",
                "User-Agent": "ApplyWise/1.0 (https://apply-wise-1.vercel.app)",
            },
            "timeout": 5,
        }
    ]
    assert len(jobs) == 1
    assert jobs[0].source == "remotive"
    assert jobs[0].external_id == "123"
    assert jobs[0].company == "Example Remote"
    assert jobs[0].location == "Worldwide"
    assert jobs[0].description == "Build Python and React services."
    assert jobs[0].posted_at.isoformat() == "2026-06-01"
    assert jobs[0].salary == "$80k - $120k"
    assert jobs[0].work_mode == "Remote"
    assert jobs[0].required_skills == frozenset({"python", "react"})


def test_remotive_provider_reuses_short_lived_cache(monkeypatch) -> None:
    calls = 0

    def fake_get(url: str, params: dict, headers: dict, timeout: float) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(
            200,
            json={"jobs": [{"id": calls, "title": "Python Engineer", "company_name": "Example", "description": "Python"}]},
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(httpx, "get", fake_get)
    provider = RemotiveJobProvider(cache_minutes=15)

    first = provider.search_jobs("python", "")
    second = provider.search_jobs("python", "")

    assert calls == 1
    assert first[0].id == second[0].id
