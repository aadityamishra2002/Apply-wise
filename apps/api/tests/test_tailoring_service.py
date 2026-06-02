from uuid import uuid4

import httpx

from app.application.resumes.service import ResumeExperience, ResumeProfile
from app.application.tailoring.service import GeminiTailoringService
from app.infrastructure.db.models import Job


def test_gemini_tailoring_uses_grounded_json_response(monkeypatch) -> None:
    def fake_post(url, params, json, timeout):
        assert params["key"] == "api-key"
        assert json["generationConfig"]["responseMimeType"] == "application/json"
        return httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": '{"professional_summary":"Product engineer with Python and React experience.","cover_letter":"Dear Example hiring team,\\n\\nI am interested in the Product Engineer role. At Northstar Labs, I built React applications with Python.\\n\\nSincerely"}'}]}}]},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    result = GeminiTailoringService("api-key").prepare(make_job(), make_profile())
    assert result.provenance == "gemini_evidence_grounded"
    assert result.resume_content["professional_summary"].startswith("Product engineer")


def test_gemini_tailoring_falls_back_when_provider_is_unavailable(monkeypatch) -> None:
    def fail_post(*args, **kwargs):
        raise httpx.TimeoutException("quota unavailable")

    monkeypatch.setattr(httpx, "post", fail_post)
    result = GeminiTailoringService("api-key").prepare(make_job(), make_profile())
    assert result.provenance == "deterministic_evidence_grounded"
    assert "Northstar Labs" in result.cover_letter


def make_job() -> Job:
    return Job(
        id=uuid4(),
        source="mock",
        external_id="job-1",
        title="Product Engineer",
        company="Example",
        location="Remote",
        url="https://example.com",
        description="Build React applications with Python.",
        description_hash="hash",
    )


def make_profile() -> ResumeProfile:
    return ResumeProfile(
        id=uuid4(),
        original_filename="resume.docx",
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        parse_status="review_required",
        extracted_text="Python React",
        detected_sections=("skills", "experience"),
        skills=("Python", "React"),
        experiences=(ResumeExperience(title="Product Engineer", company="Northstar Labs", description="Built React applications with Python."),),
    )
