from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_local_browser_origin_is_allowed() -> None:
    response = client.options(
        "/api/v1/auth/register",
        headers={
            "Origin": "http://127.0.0.1:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"


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


def test_register_and_read_current_user() -> None:
    registration = client.post(
        "/api/v1/auth/register",
        json={"email": "Avery@example.com", "password": "correct-horse-battery-staple"},
    )
    assert registration.status_code == 201
    body = registration.json()
    assert body["user"]["email"] == "avery@example.com"
    assert body["tokens"]["token_type"] == "bearer"
    assert registration.cookies.get("jobcopilot_refresh")

    current_user = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['tokens']['access_token']}"},
    )
    assert current_user.status_code == 200
    assert current_user.json()["email"] == "avery@example.com"


def test_current_user_requires_access_token() -> None:
    current_user = client.get("/api/v1/auth/me")
    assert current_user.status_code == 401


def test_duplicate_registration_is_rejected() -> None:
    payload = {"email": "avery@example.com", "password": "correct-horse-battery-staple"}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    assert client.post("/api/v1/auth/register", json=payload).status_code == 409


def test_login_rejects_invalid_password() -> None:
    payload = {"email": "avery@example.com", "password": "correct-horse-battery-staple"}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201

    login = client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": "definitely-not-correct"},
    )
    assert login.status_code == 401


def test_refresh_token_rotation_detects_reuse() -> None:
    registration = client.post(
        "/api/v1/auth/register",
        json={"email": "avery@example.com", "password": "correct-horse-battery-staple"},
    )
    original_token = registration.cookies.get("jobcopilot_refresh")
    assert original_token

    client.cookies.set("jobcopilot_refresh", original_token, path="/api/v1/auth")
    refresh = client.post("/api/v1/auth/refresh")
    assert refresh.status_code == 200
    rotated_token = refresh.cookies.get("jobcopilot_refresh")
    assert rotated_token
    assert rotated_token != original_token

    client.cookies.set("jobcopilot_refresh", original_token, path="/api/v1/auth")
    replay = client.post("/api/v1/auth/refresh")
    assert replay.status_code == 401
    assert replay.json()["detail"] == "Refresh token reuse detected."

    client.cookies.set("jobcopilot_refresh", rotated_token, path="/api/v1/auth")
    revoked_family = client.post("/api/v1/auth/refresh")
    assert revoked_family.status_code == 401


def test_logout_revokes_refresh_token() -> None:
    registration = client.post(
        "/api/v1/auth/register",
        json={"email": "avery@example.com", "password": "correct-horse-battery-staple"},
    )
    refresh_token = registration.cookies.get("jobcopilot_refresh")
    assert refresh_token

    client.cookies.set("jobcopilot_refresh", refresh_token, path="/api/v1/auth")
    logout = client.post("/api/v1/auth/logout")
    assert logout.status_code == 204

    client.cookies.set("jobcopilot_refresh", refresh_token, path="/api/v1/auth")
    refresh = client.post("/api/v1/auth/refresh")
    assert refresh.status_code == 401
