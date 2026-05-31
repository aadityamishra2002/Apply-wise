from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_jobs_are_ranked() -> None:
    response = client.get("/api/v1/jobs")
    assert response.status_code == 200
    scores = [job["match_score"] for job in response.json()]
    assert scores == sorted(scores, reverse=True)


def test_mock_job_ids_are_stable() -> None:
    first_response = client.get("/api/v1/jobs")
    second_response = client.get("/api/v1/jobs")
    first_ids = [job["id"] for job in first_response.json()]
    second_ids = [job["id"] for job in second_response.json()]
    assert first_ids == second_ids


def test_resume_analysis_detects_skills() -> None:
    response = client.post(
        "/api/v1/resumes/analyze",
        json={"text": "Summary Experience Skills Python React Docker Education"},
    )
    assert response.status_code == 200
    assert response.json()["skills"] == ["python", "react", "docker"]
