from uuid import uuid4

from app.application.jobs.ats import AtsAnalysisService, AtsWeights
from app.application.resumes.service import ResumeExperience, ResumeProfile
from app.domain.jobs.entities import Job


def test_ats_analysis_scores_resume_readiness_and_recommends_missing_sections() -> None:
    profile = ResumeProfile(
        id=uuid4(), original_filename="resume.pdf", mime_type="application/pdf", parse_status="review_required",
        extracted_text="Python FastAPI engineer " * 20, detected_sections=("summary", "experience", "skills"),
        skills=("Python", "FastAPI"), experiences=(ResumeExperience("Engineer", "Example", "Built Python services."),),
    )
    job = Job(title="Backend Engineer", company="Example", location="Remote", description="Python FastAPI PostgreSQL", required_skills=frozenset({"python", "fastapi", "postgresql"}), url="https://example.com")
    result = AtsAnalysisService(AtsWeights(0.5, 0.2, 0.15, 0.15)).analyze(job, profile)
    assert result.breakdown["keywords"] == 67
    assert result.breakdown["sections"] == 75
    assert result.score > 60
    assert any("headings" in recommendation for recommendation in result.recommendations)
