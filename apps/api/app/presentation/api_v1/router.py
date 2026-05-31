from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.application.jobs.service import JobMatchingService, MatchingWeights
from app.core.config import get_settings
from app.infrastructure.providers.mock_jobs import MockJobProvider
from app.presentation.api_v1.auth import router as auth_router

router = APIRouter()
router.include_router(auth_router)
provider = MockJobProvider()
settings = get_settings()
matching_service = JobMatchingService(
    MatchingWeights(
        skills=settings.matching_skills_weight,
        keywords=settings.matching_keywords_weight,
        experience=settings.matching_experience_weight,
    )
)


class JobResponse(BaseModel):
    id: str
    title: str
    company: str
    location: str
    work_mode: str
    salary: str | None
    description: str
    source: str
    url: str
    posted_at: str | None
    match_score: int
    matching_skills: list[str]
    missing_skills: list[str]
    experience_match: int


class ResumeAnalyzeRequest(BaseModel):
    text: str = Field(min_length=30, max_length=100_000)


class ResumeAnalyzeResponse(BaseModel):
    detected_sections: list[str]
    skills: list[str]
    status: str


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@router.get("/dashboard/summary")
def dashboard_summary() -> dict[str, object]:
    return {
        "applications": 24,
        "interviews": 6,
        "saved_jobs": 18,
        "average_match_score": 82,
        "weekly_activity": [4, 7, 3, 8, 5, 11, 6],
    }


@router.get("/jobs", response_model=list[JobResponse])
def search_jobs(
    query: Annotated[str, Query(max_length=100)] = "",
) -> list[JobResponse]:
    profile_skills = {"react", "typescript", "python", "postgresql", "docker", "sql"}
    profile_keywords = {"saas", "product", "platform", "analytics"}
    matches = matching_service.rank_jobs(
        provider.search_jobs(query),
        profile_skills,
        profile_keywords,
    )
    return [
        JobResponse(
            id=str(match.job.id),
            title=match.job.title,
            company=match.job.company,
            location=match.job.location,
            work_mode=match.job.work_mode,
            salary=match.job.salary,
            description=match.job.description,
            source=match.job.source,
            url=match.job.url,
            posted_at=match.job.posted_at.isoformat() if match.job.posted_at else None,
            match_score=match.match_score,
            matching_skills=list(match.matching_skills),
            missing_skills=list(match.missing_skills),
            experience_match=match.experience_match,
        )
        for match in matches
    ]


@router.post("/resumes/analyze", response_model=ResumeAnalyzeResponse)
def analyze_resume(payload: ResumeAnalyzeRequest) -> ResumeAnalyzeResponse:
    text = payload.text.lower()
    candidate_skills = ["python", "typescript", "react", "fastapi", "postgresql", "redis", "docker"]
    skills = [skill for skill in candidate_skills if skill in text]
    sections = [
        section
        for section in ["summary", "experience", "education", "skills", "projects"]
        if section in text
    ]
    return ResumeAnalyzeResponse(
        detected_sections=sections,
        skills=skills,
        status="review_required",
    )
