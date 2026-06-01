from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.jobs.service import JobMatchingService, MatchingWeights
from app.application.resumes.service import MAX_RESUME_BYTES, ResumeProfile, ResumeService, ResumeValidationError
from app.core.config import get_settings
from app.infrastructure.db.session import get_session
from app.infrastructure.providers.mock_jobs import MockJobProvider
from app.presentation.api_v1.auth import get_current_user, router as auth_router
from app.domain.identity.entities import UserRecord

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


class ResumeProfileResponse(BaseModel):
    id: str
    original_filename: str
    mime_type: str
    parse_status: str
    extracted_text: str
    detected_sections: list[str]
    skills: list[str]


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@router.get("/health/ready")
async def readiness(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    try:
        await session.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable.",
        ) from error
    return {"status": "ready", "database": "ok"}


@router.get("/dashboard/summary")
def dashboard_summary() -> dict[str, object]:
    return {
        "applications": 0,
        "interviews": 0,
        "saved_jobs": 0,
        "average_match_score": None,
        "weekly_activity": [0, 0, 0, 0, 0, 0, 0],
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


@router.get("/resumes/me", response_model=ResumeProfileResponse | None)
async def get_my_resume(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeProfileResponse | None:
    profile = await ResumeService(session).get_active(user.id)
    return resume_profile_response(profile) if profile else None


@router.post("/resumes/upload", response_model=ResumeProfileResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    file: Annotated[UploadFile, File(...)],
) -> ResumeProfileResponse:
    try:
        profile = await ResumeService(session).upload(
            user.id,
            file.filename or "resume",
            file.content_type or "",
            await file.read(MAX_RESUME_BYTES + 1),
        )
    except ResumeValidationError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    return resume_profile_response(profile)


def resume_profile_response(profile: ResumeProfile) -> ResumeProfileResponse:
    return ResumeProfileResponse(
        id=str(profile.id),
        original_filename=profile.original_filename,
        mime_type=profile.mime_type,
        parse_status=profile.parse_status,
        extracted_text=profile.extracted_text,
        detected_sections=list(profile.detected_sections),
        skills=list(profile.skills),
    )
