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


def test_feature_health_does_not_expose_credentials() -> None:
    response = client.get("/api/v1/health/features")
    assert response.status_code == 200
    assert response.json() == {"adzuna_enabled": False, "gemini_enabled": False, "remotive_enabled": False}


def test_provider_health_is_public_and_non_secret() -> None:
    response = client.get("/api/v1/health/providers")
    assert response.status_code == 200
    assert response.json()[0]["name"] == "mock"
    assert response.json()[0]["status"] in {"configured", "available"}
    assert "app_key" not in response.text


def test_automation_capabilities_are_public_and_manual_submit_only() -> None:
    response = client.get("/api/v1/automation/capabilities")
    assert response.status_code == 200
    capabilities = {item["site_key"]: item for item in response.json()}
    assert capabilities["linkedin"]["capture_supported"] is True
    assert capabilities["linkedin"]["dry_run_supported"] is True
    assert capabilities["linkedin"]["manual_submit_required"] is True
    assert capabilities["workday"]["autofill_supported"] is True
    assert capabilities["generic"]["autofill_supported"] is False


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
    assert response.json()[0]["ats_breakdown"]["keywords"] >= 0
    assert isinstance(response.json()[0]["high_fit"], bool)
    assert response.json()[0]["recommendation_summary"]
    assert any("resume skills" in reason for reason in response.json()[0]["recommendation_reasons"])
    summary = client.get("/api/v1/dashboard/summary", headers={"Authorization": f"Bearer {token}"}).json()
    assert summary["average_match_score"] is not None


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


def test_analytics_summary_starts_empty() -> None:
    token = register_user()["tokens"]["access_token"]
    response = client.get("/api/v1/analytics/summary", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["total_applications"] == 0
    assert response.json()["interview_rate"] == 0
    assert response.json()["offer_rate"] == 0


def test_job_preferences_are_persisted_and_used_for_default_discovery() -> None:
    token = register_user()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    upload_resume(token)
    empty = client.get("/api/v1/settings/job-preferences", headers=headers)
    assert empty.status_code == 200
    assert empty.json() == {"role_keywords": "", "location": "", "remote_only": False}

    saved = client.put(
        "/api/v1/settings/job-preferences",
        headers=headers,
        json={"role_keywords": "backend engineer", "location": "remote", "remote_only": True},
    )
    assert saved.status_code == 200
    assert saved.json()["role_keywords"] == "backend engineer"
    jobs = client.get("/api/v1/jobs", headers=headers)
    assert jobs.status_code == 200
    assert [job["title"] for job in jobs.json()] == ["Backend Engineer"]
    overridden = client.get("/api/v1/jobs?query=engineer&location=Remote", headers=headers)
    assert overridden.status_code == 200
    assert overridden.json()
    assert all("remote" in job["location"].lower() for job in overridden.json())


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
    assert upload.json()["detected_sections"] == ["summary", "experience", "education", "skills", "certifications"]
    assert upload.json()["skills"] == ["AWS", "Docker", "FastAPI", "PostgreSQL", "Python", "React", "TypeScript"]
    assert upload.json()["experiences"] == [
        {
            "title": "Senior Product Engineer",
            "company": "Northstar Labs",
            "description": "Built React and TypeScript applications with Python, FastAPI, PostgreSQL, and Docker.",
        }
    ]
    assert upload.json()["education"] == [
        {
            "institution": "State University",
            "degree": "Bachelor of Engineering",
            "year": "2021",
        }
    ]
    assert upload.json()["certifications"] == [
        {
            "name": "AWS Certified Cloud Practitioner",
            "issuer": "Amazon Web Services",
            "year": "2022",
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
    refreshed_jobs = client.get("/api/v1/jobs", headers=headers).json()
    saved_job = next(job for job in refreshed_jobs if job["id"] == jobs[0]["id"])
    assert saved_job["saved"] is True
    assert saved_job["application_id"] == saved.json()["id"]
    applications = client.get("/api/v1/applications", headers=headers)
    assert applications.status_code == 200
    assert applications.json() == [saved.json()]


def test_manual_job_capture_is_scored_and_can_be_saved() -> None:
    token = register_user()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    upload_resume(token)
    captured = client.post(
        "/api/v1/jobs/manual",
        headers=headers,
        json={
            "title": "Platform Engineer",
            "company": "Example Career Site",
            "location": "Remote",
            "url": "https://example.com/careers/platform-engineer",
            "description": "Build reliable Python and FastAPI services with PostgreSQL and Docker for customer-facing applications.",
        },
    )
    assert captured.status_code == 201
    assert captured.json()["source"] == "manual"
    assert captured.json()["match_score"] > 0
    assert "python" in captured.json()["matching_skills"]
    saved = client.post(f"/api/v1/jobs/{captured.json()['id']}/save", headers=headers)
    assert saved.status_code == 201
    captured_again = client.post(
        "/api/v1/jobs/manual",
        headers=headers,
        json={
            "title": "Manual Python Engineer",
            "company": "Example",
            "location": "Remote",
            "url": "https://example.com/careers/platform-engineer",
            "description": "Build reliable Python and FastAPI services with PostgreSQL and Docker for customer-facing applications.",
        },
    )
    assert captured_again.status_code == 201
    assert captured_again.json()["saved"] is True
    assert captured_again.json()["application_id"] == saved.json()["id"]
    approval = client.patch(f"/api/v1/jobs/{captured.json()['id']}/approval", headers=headers, json={"approval_status": "approved"})
    assert approval.status_code == 200
    assert approval.json()["approval_status"] == "approved"


def test_learning_skill_recommendations_rank_missing_skills() -> None:
    token = register_user("learning@example.com")["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    upload_resume(token)
    captured = client.post(
        "/api/v1/jobs/manual",
        headers=headers,
        json={
            "title": "Platform Engineer",
            "company": "Example",
            "location": "Remote",
            "url": "https://example.com/platform-engineer",
            "description": "Build Kubernetes and Java services with GraphQL for a platform team.",
        },
    )
    assert captured.status_code == 201
    assert client.patch(f"/api/v1/jobs/{captured.json()['id']}/approval", headers=headers, json={"approval_status": "approved"}).status_code == 200

    recommendations = client.get("/api/v1/learning/skill-recommendations", headers=headers)
    assert recommendations.status_code == 200
    skills = {item["skill"]: item for item in recommendations.json()}
    assert skills["java"]["mention_count"] == 1
    assert skills["java"]["approved_role_count"] == 1
    assert "approved" in skills["java"]["reason"]


def test_extension_pairing_code_is_one_time_and_token_is_capture_scoped() -> None:
    token = register_user("extension-owner@example.com")["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    upload_resume(token)
    pairing = client.post("/api/v1/extension/pairing-codes", headers=headers)
    assert pairing.status_code == 201
    code = pairing.json()["code"]

    exchanged = client.post("/api/v1/extension/pair", json={"code": code})
    assert exchanged.status_code == 200
    extension_headers = {"Authorization": f"Bearer {exchanged.json()['extension_token']}"}
    captured = client.post(
        "/api/v1/extension/jobs/capture",
        headers=extension_headers,
        json={
            "title": "Extension Captured Engineer",
            "company": "Example",
            "location": "Remote",
            "url": "https://example.com/careers/extension-captured-engineer",
            "description": "Build Python and FastAPI services with PostgreSQL and Docker for a customer-facing platform.",
        },
    )
    assert captured.status_code == 201
    assert captured.json()["source"] == "manual"
    assert captured.json()["application_id"]
    plan = client.get(f"/api/v1/extension/applications/{captured.json()['application_id']}/autofill-plan", headers=extension_headers)
    assert plan.status_code == 200
    fields = {field["field_key"]: field for field in plan.json()["fields"]}
    assert fields["email"]["value"] == "extension-owner@example.com"
    assert fields["email"]["requires_review"] is True
    assert fields["skills"]["confidence"] >= 0.75
    event = client.post(
        f"/api/v1/extension/applications/{captured.json()['application_id']}/events",
        headers=extension_headers,
        json={"event_type": "autofill_attempted", "metadata": {"filled": [{"field_key": "skills"}], "skipped": []}},
    )
    assert event.status_code == 201
    prepared = client.post(f"/api/v1/applications/{captured.json()['application_id']}/prepare", headers=headers)
    assert prepared.status_code == 201
    downloaded = client.get(f"/api/v1/extension/applications/{captured.json()['application_id']}/resume-download?format=pdf", headers=extension_headers)
    assert downloaded.status_code == 200
    assert downloaded.headers["content-type"] == "application/pdf"
    assert client.get("/api/v1/applications", headers=extension_headers).status_code == 401
    assert client.post("/api/v1/extension/pair", json={"code": code}).status_code == 401


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
    assert updated.json()["applied_at"] is None
    applied = client.patch(f"/api/v1/applications/{application['id']}", headers=headers, json={"status": "applied"})
    assert applied.status_code == 200
    assert applied.json()["status"] == "applied"
    assert applied.json()["applied_at"]
    updated = client.patch(f"/api/v1/applications/{application['id']}", headers=headers, json={"status": "interview"})
    assert updated.status_code == 200
    assert updated.json()["applied_at"] == applied.json()["applied_at"]
    summary = client.get("/api/v1/dashboard/summary", headers=headers).json()
    assert summary["applications"] == 1
    assert summary["interviews"] == 1
    assert summary["saved_jobs"] == 0
    assert sum(summary["weekly_activity"]) == 1
    analytics = client.get("/api/v1/analytics/summary", headers=headers).json()
    assert analytics["total_applications"] == 1
    assert analytics["interview_rate"] == 100


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


def test_application_notes_create_visible_timeline_event() -> None:
    token = register_user()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    upload_resume(token)
    job = client.get("/api/v1/jobs", headers=headers).json()[0]
    application = client.post(f"/api/v1/jobs/{job['id']}/save", headers=headers).json()
    updated = client.patch(
        f"/api/v1/applications/{application['id']}",
        headers=headers,
        json={"notes": "Follow up with the recruiter on Friday."},
    )
    assert updated.status_code == 200
    assert updated.json()["notes"] == "Follow up with the recruiter on Friday."
    events = client.get(f"/api/v1/applications/{application['id']}/events", headers=headers)
    assert events.status_code == 200
    assert events.json()[0]["event_type"] == "notes_updated"


def test_interview_round_is_scheduled_and_updates_pipeline() -> None:
    token = register_user()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    upload_resume(token)
    job = client.get("/api/v1/jobs", headers=headers).json()[0]
    application = client.post(f"/api/v1/jobs/{job['id']}/save", headers=headers).json()
    scheduled = client.post(
        f"/api/v1/applications/{application['id']}/interviews",
        headers=headers,
        json={"interview_round": "Recruiter screen", "scheduled_at": "2026-06-10T10:30:00Z", "notes": "Prepare role summary."},
    )
    assert scheduled.status_code == 201
    assert scheduled.json()["interview_round"] == "Recruiter screen"
    interviews = client.get(f"/api/v1/applications/{application['id']}/interviews", headers=headers)
    assert interviews.json()[0]["notes"] == "Prepare role summary."
    interview_id = interviews.json()[0]["id"]
    updated = client.patch(
        f"/api/v1/applications/{application['id']}/interviews/{interview_id}",
        headers=headers,
        json={"interview_round": "Technical interview", "scheduled_at": "2026-06-12T11:00:00Z", "notes": "Review system design."},
    )
    assert updated.status_code == 200
    assert updated.json()["interview_round"] == "Technical interview"
    assert updated.json()["notes"] == "Review system design."
    removed = client.delete(f"/api/v1/applications/{application['id']}/interviews/{interview_id}", headers=headers)
    assert removed.status_code == 204
    assert client.get(f"/api/v1/applications/{application['id']}/interviews", headers=headers).json() == []
    assert client.get("/api/v1/applications", headers=headers).json()[0]["status"] == "interview"


def test_prepare_application_persists_truthful_resume_and_cover_letter_drafts() -> None:
    token = register_user()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    upload_resume(token)
    job = client.get("/api/v1/jobs", headers=headers).json()[0]
    application = client.post(f"/api/v1/jobs/{job['id']}/save", headers=headers).json()

    prepared = client.post(f"/api/v1/applications/{application['id']}/prepare", headers=headers)
    assert prepared.status_code == 201
    body = prepared.json()
    assert body["application"]["status"] == "preparing"
    assert body["resume_content"]["draft_type"] == "deterministic_evidence_grounded"
    assert body["resume_content"]["source_resume_id"]
    assert body["resume_content"]["experience"][0]["company"] == "Northstar Labs"
    assert "Northstar Labs" in body["cover_letter"]
    assert body["resume_version_id"]
    assert body["cover_letter_id"]
    assert body["provenance"] == "deterministic_evidence_grounded"
    assert body["generation_status"] == "fallback_no_provider"
    assert body["retry_attempts"] == 1
    versions = client.get("/api/v1/resume-versions", headers=headers)
    assert versions.status_code == 200
    assert versions.json()[0]["id"] == body["resume_version_id"]
    assert versions.json()[0]["job_title"] == job["title"]
    docx = client.get(f"/api/v1/resume-versions/{body['resume_version_id']}/download?format=docx", headers=headers)
    assert docx.status_code == 200
    assert docx.headers["content-type"].startswith("application/vnd.openxmlformats-officedocument")
    assert docx.content.startswith(b"PK")
    pdf = client.get(f"/api/v1/resume-versions/{body['resume_version_id']}/download?format=pdf", headers=headers)
    assert pdf.status_code == 200
    assert pdf.headers["content-type"].startswith("application/pdf")
    assert pdf.content.startswith(b"%PDF")
    export_events = client.get(f"/api/v1/applications/{application['id']}/events", headers=headers)
    assert export_events.status_code == 200
    assert any(event["event_type"] == "resume_export_downloaded" and event["metadata"]["retry_attempts"] == 1 for event in export_events.json())
    version_detail = client.get(f"/api/v1/resume-versions/{body['resume_version_id']}", headers=headers)
    assert version_detail.status_code == 200
    edited_content = dict(version_detail.json()["resume_content"])
    edited_content["professional_summary"] = "Product engineer focused on reliable Python, React, and PostgreSQL systems."
    edited_content["skills"] = ["Python", "React", "PostgreSQL"]
    edited = client.patch(
        f"/api/v1/resume-versions/{body['resume_version_id']}",
        headers=headers,
        json={"resume_content": edited_content},
    )
    assert edited.status_code == 200
    assert edited.json()["resume_content"]["professional_summary"].startswith("Product engineer")
    edited_docx = client.get(f"/api/v1/resume-versions/{body['resume_version_id']}/download?format=docx", headers=headers)
    edited_document = Document(BytesIO(edited_docx.content))
    assert any("Product engineer focused" in paragraph.text for paragraph in edited_document.paragraphs)
    cover_letter = client.get(f"/api/v1/cover-letters/{body['cover_letter_id']}/download", headers=headers)
    assert cover_letter.status_code == 200
    assert cover_letter.headers["content-type"].startswith("text/plain")
    assert "Northstar Labs" in cover_letter.text
    assert "cover-letter-linear-senior-product-engineer.txt" in cover_letter.headers["content-disposition"]
    loaded_cover_letter = client.get(f"/api/v1/cover-letters/{body['cover_letter_id']}", headers=headers)
    assert loaded_cover_letter.status_code == 200
    assert loaded_cover_letter.json()["content"] == cover_letter.text
    edited = client.patch(
        f"/api/v1/cover-letters/{body['cover_letter_id']}",
        headers=headers,
        json={"content": "Dear hiring team,\n\nI am excited to apply with my Python and React experience from Northstar Labs."},
    )
    assert edited.status_code == 200
    assert "excited to apply" in edited.json()["content"]
    downloaded_edit = client.get(f"/api/v1/cover-letters/{body['cover_letter_id']}/download", headers=headers)
    assert "excited to apply" in downloaded_edit.text


def test_assisted_application_checklist_tracks_readiness_without_auto_submit() -> None:
    token = register_user()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    upload_resume(token)
    job = client.get("/api/v1/jobs", headers=headers).json()[0]
    application = client.post(f"/api/v1/jobs/{job['id']}/save", headers=headers).json()

    checklist_url = f"/api/v1/applications/{application['id']}/assisted-checklist"
    checklist = client.get(checklist_url, headers=headers)
    assert checklist.status_code == 200
    assert checklist.json() == {
        "application_id": application["id"],
        "duplicate_prevention": True,
        "ats_approved": False,
        "resume_prepared": False,
        "resume_version_id": None,
        "cover_letter_prepared": False,
        "cover_letter_id": None,
        "target_url": job["url"],
        "manual_final_submission_required": True,
    }

    approval = client.patch(f"/api/v1/jobs/{job['id']}/approval", headers=headers, json={"approval_status": "approved"})
    assert approval.status_code == 200
    assert client.post(f"/api/v1/applications/{application['id']}/prepare", headers=headers).status_code == 201
    prepared = client.get(checklist_url, headers=headers).json()
    assert prepared["ats_approved"] is True
    assert prepared["resume_prepared"] is True
    assert prepared["resume_version_id"]
    assert prepared["cover_letter_prepared"] is True
    assert prepared["cover_letter_id"]
    assert prepared["manual_final_submission_required"] is True


def test_application_automation_plan_is_dry_run_and_owner_scoped() -> None:
    token = register_user("automation-owner@example.com")["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    upload_resume(token)
    captured = client.post(
        "/api/v1/jobs/manual",
        headers=headers,
        json={
            "title": "LinkedIn Easy Apply Engineer",
            "company": "Example",
            "location": "Remote",
            "url": "https://www.linkedin.com/jobs/view/123",
            "description": "Build Python and FastAPI services with React dashboards and PostgreSQL.",
        },
    )
    saved = client.post(f"/api/v1/jobs/{captured.json()['id']}/save", headers=headers).json()
    plan = client.get(f"/api/v1/applications/{saved['id']}/automation-plan", headers=headers)
    assert plan.status_code == 200
    assert plan.json()["capability"]["site_key"] == "linkedin"
    assert plan.json()["manual_final_submission_required"] is True
    assert plan.json()["steps"][-1]["action"] == "stop_before_submit"
    assert "Prepare a tailored resume" in " ".join(plan.json()["warnings"])

    assert client.post(f"/api/v1/applications/{saved['id']}/prepare", headers=headers).status_code == 201
    prepared_plan = client.get(f"/api/v1/applications/{saved['id']}/automation-plan", headers=headers)
    assert prepared_plan.status_code == 200
    assert "Prepare a tailored resume" not in " ".join(prepared_plan.json()["warnings"])

    outsider = register_user("automation-outsider@example.com")["tokens"]["access_token"]
    assert client.get(f"/api/v1/applications/{saved['id']}/automation-plan", headers={"Authorization": f"Bearer {outsider}"}).status_code == 404


def test_application_automation_runs_are_tracked_and_guarded() -> None:
    token = register_user("automation-run-owner@example.com")["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    upload_resume(token)
    captured = client.post(
        "/api/v1/jobs/manual",
        headers=headers,
        json={
            "title": "Greenhouse Engineer",
            "company": "Example",
            "location": "Remote",
            "url": "https://boards.greenhouse.io/example/jobs/123",
            "description": "Build Python and FastAPI services with React dashboards and PostgreSQL.",
        },
    )
    saved = client.post(f"/api/v1/jobs/{captured.json()['id']}/save", headers=headers).json()
    blocked = client.post(f"/api/v1/applications/{saved['id']}/automation-runs", headers=headers)
    assert blocked.status_code == 201
    assert blocked.json()["status"] == "blocked"
    assert "Prepare a tailored resume" in " ".join(blocked.json()["warnings"])
    assert blocked.json()["manual_final_submission_required"] is True

    runs = client.get(f"/api/v1/applications/{saved['id']}/automation-runs", headers=headers)
    assert runs.status_code == 200
    assert runs.json()[0]["id"] == blocked.json()["id"]

    assert client.post(f"/api/v1/applications/{saved['id']}/prepare", headers=headers).status_code == 201
    ready = client.post(f"/api/v1/applications/{saved['id']}/automation-runs", headers=headers)
    assert ready.status_code == 201
    assert ready.json()["status"] == "ready_for_user_review"
    assert ready.json()["warnings"] == []
    assert ready.json()["result"]["next_action"].startswith("Open the employer page")

    events = client.get(f"/api/v1/applications/{saved['id']}/events", headers=headers).json()
    assert any(event["event_type"] == "automation_run_created" for event in events)
    outsider = register_user("automation-run-outsider@example.com")["tokens"]["access_token"]
    assert client.get(f"/api/v1/applications/{saved['id']}/automation-runs", headers={"Authorization": f"Bearer {outsider}"}).status_code == 404
    assert client.post(f"/api/v1/applications/{saved['id']}/automation-runs", headers={"Authorization": f"Bearer {outsider}"}).status_code == 404


def test_prepare_runs_track_background_material_generation() -> None:
    token = register_user("prepare-run-owner@example.com")["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    upload_resume(token)
    captured = client.post(
        "/api/v1/jobs/manual",
        headers=headers,
        json={
            "title": "Async Prep Engineer",
            "company": "Example",
            "location": "Remote",
            "url": "https://jobs.lever.co/example/123",
            "description": "Build Python and FastAPI services with React dashboards and PostgreSQL.",
        },
    )
    saved = client.post(f"/api/v1/jobs/{captured.json()['id']}/save", headers=headers).json()
    queued = client.post(f"/api/v1/applications/{saved['id']}/prepare-runs", headers=headers)
    assert queued.status_code == 202
    assert queued.json()["job_type"] == "prepare_application_materials"
    assert queued.json()["status"] in {"queued", "running", "succeeded"}

    job = client.get(f"/api/v1/background-jobs/{queued.json()['id']}", headers=headers)
    assert job.status_code == 200
    assert job.json()["status"] == "succeeded"
    assert job.json()["result"]["resume_version_id"]
    assert job.json()["result"]["cover_letter_id"]

    jobs = client.get(f"/api/v1/applications/{saved['id']}/prepare-runs", headers=headers)
    assert jobs.status_code == 200
    assert jobs.json()[0]["id"] == queued.json()["id"]
    events = client.get(f"/api/v1/applications/{saved['id']}/events", headers=headers).json()
    assert any(event["event_type"] == "prepare_job_queued" for event in events)
    assert any(event["event_type"] == "prepare_job_succeeded" for event in events)

    outsider = register_user("prepare-run-outsider@example.com")["tokens"]["access_token"]
    assert client.get(f"/api/v1/background-jobs/{queued.json()['id']}", headers={"Authorization": f"Bearer {outsider}"}).status_code == 404
    assert client.get(f"/api/v1/applications/{saved['id']}/prepare-runs", headers={"Authorization": f"Bearer {outsider}"}).status_code == 404


def test_review_before_apply_packages_materials_and_manual_attention() -> None:
    token = register_user("review-before-apply@example.com")["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    upload_resume(token)
    captured = client.post(
        "/api/v1/jobs/manual",
        headers=headers,
        json={
            "title": "Review Engineer",
            "company": "Example",
            "location": "Remote",
            "url": "https://boards.greenhouse.io/example/jobs/123",
            "description": "Build Python and FastAPI services with React dashboards and PostgreSQL.",
        },
    )
    saved = client.post(f"/api/v1/jobs/{captured.json()['id']}/save", headers=headers).json()
    review = client.get(f"/api/v1/applications/{saved['id']}/review-before-apply", headers=headers)
    assert review.status_code == 200
    assert review.json()["manual_final_submission_required"] is True
    assert review.json()["resume_prepared"] is False
    assert "Tailored resume" in review.json()["missing_fields"]
    assert "Apply Wise does not submit" in " ".join(review.json()["warnings"])

    assert client.post(f"/api/v1/applications/{saved['id']}/prepare", headers=headers).status_code == 201
    prepared_review = client.get(f"/api/v1/applications/{saved['id']}/review-before-apply", headers=headers)
    assert prepared_review.status_code == 200
    assert prepared_review.json()["resume_prepared"] is True
    assert prepared_review.json()["cover_letter_prepared"] is True
    assert "Tailored resume" not in prepared_review.json()["missing_fields"]
    version_id = client.get(f"/api/v1/applications/{saved['id']}/assisted-checklist", headers=headers).json()["resume_version_id"]
    version = client.get(f"/api/v1/resume-versions/{version_id}", headers=headers).json()
    edited_content = dict(version["resume_content"])
    edited_content["skills"] = [*edited_content["skills"], "Kubernetes"]
    edited_content["experience"] = [
        *edited_content["experience"],
        {"title": "Principal Engineer", "company": "Acme Corp", "description": "Improved reliability by 45%."},
    ]
    assert client.patch(f"/api/v1/resume-versions/{version_id}", headers=headers, json={"resume_content": edited_content}).status_code == 200
    warned_review = client.get(f"/api/v1/applications/{saved['id']}/review-before-apply", headers=headers)
    assert warned_review.status_code == 200
    assert any("Kubernetes" in warning for warning in warned_review.json()["quality_warnings"])
    assert any("Acme Corp" in warning for warning in warned_review.json()["quality_warnings"])
    blocked_download = client.get(f"/api/v1/resume-versions/{version_id}/download?format=pdf", headers=headers)
    assert blocked_download.status_code == 409
    assert "quality_warnings" in blocked_download.json()["detail"]
    acknowledged_download = client.get(f"/api/v1/resume-versions/{version_id}/download?format=pdf&acknowledge_quality_warnings=true", headers=headers)
    assert acknowledged_download.status_code == 200

    outsider = register_user("review-outsider@example.com")["tokens"]["access_token"]
    assert client.get(f"/api/v1/applications/{saved['id']}/review-before-apply", headers={"Authorization": f"Bearer {outsider}"}).status_code == 404


def test_resume_download_is_scoped_to_its_owner() -> None:
    owner_token = register_user("owner-download@example.com")["tokens"]["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    upload_resume(owner_token)
    job = client.get("/api/v1/jobs", headers=owner_headers).json()[0]
    application = client.post(f"/api/v1/jobs/{job['id']}/save", headers=owner_headers).json()
    version_id = client.post(f"/api/v1/applications/{application['id']}/prepare", headers=owner_headers).json()["resume_version_id"]

    other_token = register_user("other-download@example.com")["tokens"]["access_token"]
    response = client.get(
        f"/api/v1/resume-versions/{version_id}/download?format=pdf",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert response.status_code == 404
    assert client.get(f"/api/v1/resume-versions/{version_id}", headers={"Authorization": f"Bearer {other_token}"}).status_code == 404
    assert client.patch(
        f"/api/v1/resume-versions/{version_id}",
        headers={"Authorization": f"Bearer {other_token}"},
        json={"resume_content": {"skills": ["Python"], "experience": [{"title": "Other", "company": "Other", "description": "Nope"}]}},
    ).status_code == 404


def test_cover_letter_download_is_scoped_to_its_owner() -> None:
    owner_token = register_user("owner-cover@example.com")["tokens"]["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    upload_resume(owner_token)
    job = client.get("/api/v1/jobs", headers=owner_headers).json()[0]
    application = client.post(f"/api/v1/jobs/{job['id']}/save", headers=owner_headers).json()
    cover_letter_id = client.post(f"/api/v1/applications/{application['id']}/prepare", headers=owner_headers).json()["cover_letter_id"]

    other_token = register_user("other-cover@example.com")["tokens"]["access_token"]
    response = client.get(
        f"/api/v1/cover-letters/{cover_letter_id}/download",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert response.status_code == 404
    assert client.get(f"/api/v1/cover-letters/{cover_letter_id}", headers={"Authorization": f"Bearer {other_token}"}).status_code == 404
    assert client.patch(
        f"/api/v1/cover-letters/{cover_letter_id}",
        headers={"Authorization": f"Bearer {other_token}"},
        json={"content": "This edit should not be allowed for another user's cover letter."},
    ).status_code == 404


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


def test_owner_subscription_bypass_and_member_free_tier() -> None:
    owner = register_user("owner@example.com")
    owner_subscription = client.get(
        "/api/v1/billing/subscription",
        headers={"Authorization": f"Bearer {owner['tokens']['access_token']}"},
    )
    assert owner_subscription.status_code == 200
    assert owner_subscription.json()["plan"] == "owner"
    assert owner_subscription.json()["owner_bypass"] is True
    assert "gemini_tailoring" in owner_subscription.json()["features"]

    member = register_user("member-subscription@example.com")
    member_subscription = client.get(
        "/api/v1/billing/subscription",
        headers={"Authorization": f"Bearer {member['tokens']['access_token']}"},
    )
    assert member_subscription.status_code == 200
    assert member_subscription.json()["plan"] == "free"
    assert member_subscription.json()["owner_bypass"] is False


def test_admin_summary_is_owner_only() -> None:
    owner = register_user("owner@example.com")
    owner_response = client.get(
        "/api/v1/admin/summary",
        headers={"Authorization": f"Bearer {owner['tokens']['access_token']}"},
    )
    assert owner_response.status_code == 200
    assert owner_response.json()["users"] >= 1
    assert "applications" in owner_response.json()

    member = register_user("member-admin-summary@example.com")
    member_response = client.get(
        "/api/v1/admin/summary",
        headers={"Authorization": f"Bearer {member['tokens']['access_token']}"},
    )
    assert member_response.status_code == 403


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


def test_authenticated_user_can_change_password_and_revoke_refresh_tokens() -> None:
    payload = {"email": "avery@example.com", "password": "correct-horse-battery-staple"}
    registration = client.post("/api/v1/auth/register", json=payload)
    assert registration.status_code == 201
    access_token = registration.json()["tokens"]["access_token"]
    refresh_token = registration.cookies.get("jobcopilot_refresh")
    assert refresh_token

    wrong_current = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"current_password": "wrong-password", "new_password": "new-correct-horse-password"},
    )
    assert wrong_current.status_code == 401

    changed = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"current_password": payload["password"], "new_password": "new-correct-horse-password"},
    )
    assert changed.status_code == 204

    assert client.post("/api/v1/auth/login", json=payload).status_code == 401
    assert client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": "new-correct-horse-password"},
    ).status_code == 200
    client.cookies.set("jobcopilot_refresh", refresh_token, path="/api/v1/auth")
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_password_reset_changes_password_and_rejects_token_reuse() -> None:
    payload = {"email": "reset@example.com", "password": "correct-horse-battery-staple"}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    requested = client.post("/api/v1/auth/password-reset/request", json={"email": payload["email"]})
    assert requested.status_code == 200
    assert requested.json()["message"].startswith("If an account exists")
    token = requested.json()["reset_url"].split("token=", 1)[1]

    reset = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": token, "new_password": "new-correct-horse-password"},
    )
    assert reset.status_code == 204
    assert client.post("/api/v1/auth/login", json=payload).status_code == 401
    assert client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": "new-correct-horse-password"},
    ).status_code == 200
    reused = client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": token, "new_password": "another-new-password"},
    )
    assert reused.status_code == 401


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


def register_user(email: str = "resume-owner@example.com") -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "correct-horse-battery-staple"},
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
    document.add_paragraph("State University - Bachelor of Engineering - 2021")
    document.add_heading("Certifications", level=1)
    document.add_paragraph("AWS Certified Cloud Practitioner - Amazon Web Services - 2022")
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
