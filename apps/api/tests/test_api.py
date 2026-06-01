from io import BytesIO

import fitz
from docx import Document
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["x-request-id"]


def test_readiness_checks_database() -> None:
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "ok"}


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
    token = register_user()["tokens"]["access_token"]
    upload_resume(token)
    response = client.get("/api/v1/jobs", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    scores = [job["match_score"] for job in response.json()]
    assert scores == sorted(scores, reverse=True)


def test_dashboard_summary_starts_empty() -> None:
    token = register_user()["tokens"]["access_token"]
    response = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == {
        "applications": 0,
        "interviews": 0,
        "saved_jobs": 0,
        "average_match_score": None,
        "weekly_activity": [0, 0, 0, 0, 0, 0, 0],
    }


def test_mock_job_ids_are_stable() -> None:
    token = register_user()["tokens"]["access_token"]
    upload_resume(token)
    headers = {"Authorization": f"Bearer {token}"}
    first_response = client.get("/api/v1/jobs", headers=headers)
    second_response = client.get("/api/v1/jobs", headers=headers)
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


def test_resume_upload_requires_authentication() -> None:
    response = client.post(
        "/api/v1/resumes/upload",
        files={"file": ("resume.docx", make_resume_docx(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert response.status_code == 401


def test_docx_resume_upload_extracts_and_persists_profile() -> None:
    token = register_user()["tokens"]["access_token"]
    upload = client.post(
        "/api/v1/resumes/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("resume.docx", make_resume_docx(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert upload.status_code == 201
    assert upload.json()["original_filename"] == "resume.docx"
    assert upload.json()["parse_status"] == "review_required"
    assert upload.json()["detected_sections"] == ["summary", "experience", "education", "skills"]
    assert upload.json()["skills"] == ["Docker", "FastAPI", "PostgreSQL", "Python", "React", "TypeScript"]
    assert upload.json()["experiences"] == [
        {
            "title": "Senior Product Engineer",
            "company": "Northstar Labs",
            "description": "Built React and TypeScript applications with Python, FastAPI, PostgreSQL, and Docker.",
        }
    ]

    profile = client.get(
        "/api/v1/resumes/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert profile.status_code == 200
    assert profile.json() == upload.json()


def test_pdf_resume_upload_extracts_profile() -> None:
    token = register_user()["tokens"]["access_token"]
    upload = client.post(
        "/api/v1/resumes/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("resume.pdf", make_resume_pdf(), "application/pdf")},
    )
    assert upload.status_code == 201
    assert upload.json()["original_filename"] == "resume.pdf"
    assert upload.json()["skills"] == ["Docker", "Python", "React"]


def test_resume_upload_rejects_unsupported_file() -> None:
    token = register_user()["tokens"]["access_token"]
    upload = client.post(
        "/api/v1/resumes/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("resume.txt", b"Summary Skills Python React Docker", "text/plain")},
    )
    assert upload.status_code == 422
    assert upload.json()["detail"] == "Upload a PDF or DOCX resume."


def test_jobs_require_resume_and_saved_job_appears_in_tracker() -> None:
    token = register_user()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/jobs", headers=headers).json() == []
    upload_resume(token)
    jobs = client.get("/api/v1/jobs", headers=headers).json()
    assert jobs
    saved = client.post(f"/api/v1/jobs/{jobs[0]['id']}/save", headers=headers)
    assert saved.status_code == 201
    assert saved.json()["status"] == "saved"
    applications = client.get("/api/v1/applications", headers=headers)
    assert applications.status_code == 200
    assert applications.json() == [saved.json()]


def test_application_status_update_changes_dashboard_summary() -> None:
    token = register_user()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    upload_resume(token)
    job = client.get("/api/v1/jobs", headers=headers).json()[0]
    application = client.post(f"/api/v1/jobs/{job['id']}/save", headers=headers).json()
    assert client.get("/api/v1/dashboard/summary", headers=headers).json()["saved_jobs"] == 1

    updated = client.patch(f"/api/v1/applications/{application['id']}", headers=headers, json={"status": "interview"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "interview"
    summary = client.get("/api/v1/dashboard/summary", headers=headers).json()
    assert summary["applications"] == 1
    assert summary["interviews"] == 1
    assert summary["saved_jobs"] == 0
    assert sum(summary["weekly_activity"]) == 1


def test_application_update_is_owner_scoped() -> None:
    token = register_user()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    upload_resume(token)
    job = client.get("/api/v1/jobs", headers=headers).json()[0]
    application = client.post(f"/api/v1/jobs/{job['id']}/save", headers=headers).json()
    outsider = client.post(
        "/api/v1/auth/register",
        json={"email": "outsider@example.com", "password": "correct-horse-battery-staple"},
    ).json()["tokens"]["access_token"]
    response = client.patch(
        f"/api/v1/applications/{application['id']}",
        headers={"Authorization": f"Bearer {outsider}"},
        json={"status": "offer"},
    )
    assert response.status_code == 404


def test_register_and_read_current_user() -> None:
    registration = client.post(
        "/api/v1/auth/register",
        json={"email": "Avery@example.com", "password": "correct-horse-battery-staple"},
    )
    assert registration.status_code == 201
    body = registration.json()
    assert body["user"]["email"] == "avery@example.com"
    assert body["user"]["role"] == "member"
    assert body["tokens"]["token_type"] == "bearer"
    assert registration.cookies.get("jobcopilot_refresh")

    current_user = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['tokens']['access_token']}"},
    )
    assert current_user.status_code == 200
    assert current_user.json()["email"] == "avery@example.com"
    assert current_user.json()["role"] == "member"


def test_allowlisted_owner_registers_as_admin() -> None:
    registration = client.post(
        "/api/v1/auth/register",
        json={"email": "OWNER@example.com", "password": "correct-horse-battery-staple"},
    )
    assert registration.status_code == 201
    assert registration.json()["user"]["role"] == "admin"


def test_existing_allowlisted_owner_becomes_admin_on_login(monkeypatch) -> None:
    payload = {"email": "avery@example.com", "password": "correct-horse-battery-staple"}
    assert client.post("/api/v1/auth/register", json=payload).json()["user"]["role"] == "member"

    monkeypatch.setattr(get_settings(), "admin_emails", payload["email"])
    login = client.post("/api/v1/auth/login", json=payload)
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "admin"


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


def register_user() -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "resume-owner@example.com", "password": "correct-horse-battery-staple"},
    )
    assert response.status_code == 201
    return response.json()


def make_resume_docx() -> bytes:
    document = Document()
    document.add_heading("Summary", level=1)
    document.add_paragraph("Product engineer building reliable user-facing software.")
    document.add_heading("Experience", level=1)
    document.add_paragraph("Senior Product Engineer")
    document.add_paragraph("Northstar Labs")
    document.add_paragraph("Built React and TypeScript applications with Python, FastAPI, PostgreSQL, and Docker.")
    document.add_heading("Education", level=1)
    document.add_paragraph("Bachelor of Engineering")
    document.add_heading("Skills", level=1)
    document.add_paragraph("React TypeScript Python FastAPI PostgreSQL Docker")
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def upload_resume(token: str) -> None:
    response = client.post(
        "/api/v1/resumes/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("resume.docx", make_resume_docx(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert response.status_code == 201


def make_resume_pdf() -> bytes:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), "Summary\nExperience\nSkills\nPython React Docker\nEducation")
    content = document.tobytes()
    document.close()
    return content
