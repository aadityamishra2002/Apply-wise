import httpx

from app.infrastructure.providers.adzuna_jobs import AdzunaJobProvider


def test_adzuna_provider_maps_search_results(monkeypatch) -> None:
    def fake_get(url, params, headers, timeout):
        assert url == "https://api.adzuna.com/v1/api/jobs/in/search/1"
        assert params["what"] == "python"
        assert params["where"] == "bengaluru"
        return httpx.Response(
            200,
            json={
                "results": [
                    {
                        "id": "adzuna-123",
                        "title": "Python Engineer",
                        "company": {"display_name": "Example Co"},
                        "location": {"display_name": "Bengaluru"},
                        "description": "Build Python and FastAPI services with PostgreSQL.",
                        "redirect_url": "https://www.adzuna.in/jobs/adzuna-123",
                        "created": "2026-06-01T10:20:30Z",
                        "salary_min": 1200000,
                        "salary_max": 1800000,
                    }
                ]
            },
            request=httpx.Request("GET", url),
        )

    monkeypatch.setattr(httpx, "get", fake_get)
    jobs = AdzunaJobProvider("app-id", "app-key").search_jobs(" python ", " bengaluru ")
    assert len(jobs) == 1
    assert jobs[0].source == "adzuna"
    assert jobs[0].company == "Example Co"
    assert jobs[0].required_skills == frozenset({"python", "fastapi", "postgresql"})
    assert jobs[0].salary == "₹1,200,000 - ₹1,800,000"
