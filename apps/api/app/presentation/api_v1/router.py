from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.jobs.service import JobMatchingService, MatchingWeights
from app.application.resumes.service import MAX_RESUME_BYTES, ResumeProfile, ResumeService, ResumeValidationError
from app.core.config import get_settings
from app.infrastructure.db.models import Application, ApplicationEvent, ApplicationStatus, CoverLetter, Job, JobMatch, ResumeVersion
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
    experiences: list["ResumeExperienceResponse"]


class ResumeExperienceResponse(BaseModel):
    title: str
    company: str
    description: str


class ApplicationResponse(BaseModel):
    id: str
    job_id: str
    company: str
    title: str
    status: str
    created_at: str


class ApplicationUpdateRequest(BaseModel):
    status: ApplicationStatus


class DashboardSummaryResponse(BaseModel):
    applications: int
    interviews: int
    saved_jobs: int
    average_match_score: float | None
    weekly_activity: list[int]


class ApplicationMaterialsResponse(BaseModel):
    application: ApplicationResponse
    resume_version_id: str
    ats_score: float
    resume_content: dict
    cover_letter_id: str
    cover_letter: str


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


@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DashboardSummaryResponse:
    applications = await session.scalar(select(func.count()).select_from(Application).where(Application.user_id == user.id))
    interviews = await session.scalar(
        select(func.count()).select_from(Application).where(
            Application.user_id == user.id,
            Application.status == ApplicationStatus.INTERVIEW,
        )
    )
    saved_jobs = await session.scalar(
        select(func.count()).select_from(Application).where(
            Application.user_id == user.id,
            Application.status == ApplicationStatus.SAVED,
        )
    )
    average_match_score = await session.scalar(select(func.avg(JobMatch.match_score)).where(JobMatch.user_id == user.id))
    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=6)
    created_dates = (
        await session.scalars(
            select(Application.created_at).where(
                Application.user_id == user.id,
                Application.created_at >= datetime.combine(week_start, datetime.min.time(), tzinfo=timezone.utc),
            )
        )
    ).all()
    weekly_activity = [0] * 7
    for created_at in created_dates:
        weekly_activity[(created_at.date() - week_start).days] += 1
    return DashboardSummaryResponse(
        applications=applications or 0,
        interviews=interviews or 0,
        saved_jobs=saved_jobs or 0,
        average_match_score=round(float(average_match_score), 1) if average_match_score is not None else None,
        weekly_activity=weekly_activity,
    )


@router.get("/jobs", response_model=list[JobResponse])
async def search_jobs(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    query: Annotated[str, Query(max_length=100)] = "",
) -> list[JobResponse]:
    profile = await ResumeService(session).get_active(user.id)
    if not profile:
        return []
    profile_skills = {skill.lower() for skill in profile.skills}
    profile_keywords = set(profile.extracted_text.lower().split())
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


@router.post("/jobs/{job_id}/save", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def save_job(
    job_id: str,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationResponse:
    matched_job = next((job for job in provider.search_jobs() if str(job.id) == job_id), None)
    if not matched_job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    stored_job = await session.scalar(select(Job).where(Job.source == matched_job.source, Job.external_id == matched_job.external_id))
    if not stored_job:
        stored_job = Job(
            id=matched_job.id,
            source=matched_job.source,
            external_id=matched_job.external_id or str(matched_job.id),
            title=matched_job.title,
            company=matched_job.company,
            location=matched_job.location,
            salary=matched_job.salary,
            url=matched_job.url,
            description=matched_job.description,
            description_hash=str(matched_job.id),
        )
        session.add(stored_job)
        await session.flush()
    application = await session.scalar(select(Application).where(Application.user_id == user.id, Application.job_id == stored_job.id))
    if not application:
        application = Application(user_id=user.id, job_id=stored_job.id, status=ApplicationStatus.SAVED)
        session.add(application)
        await session.commit()
    return application_response(application, stored_job)


@router.get("/applications", response_model=list[ApplicationResponse])
async def list_applications(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ApplicationResponse]:
    rows = await session.execute(
        select(Application, Job).join(Job, Application.job_id == Job.id).where(Application.user_id == user.id).order_by(Application.created_at.desc())
    )
    return [application_response(application, job) for application, job in rows.all()]


@router.patch("/applications/{application_id}", response_model=ApplicationResponse)
async def update_application(
    application_id: UUID,
    payload: ApplicationUpdateRequest,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationResponse:
    row = await session.execute(
        select(Application, Job)
        .join(Job, Application.job_id == Job.id)
        .where(Application.id == application_id, Application.user_id == user.id)
    )
    result = row.one_or_none()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    application, job = result
    if application.status != payload.status:
        previous_status = application.status
        application.status = payload.status
        if payload.status == ApplicationStatus.APPLIED and application.applied_at is None:
            application.applied_at = datetime.now(timezone.utc)
        session.add(
            ApplicationEvent(
                application_id=application.id,
                event_type="status_changed",
                from_status=previous_status.value,
                to_status=payload.status.value,
            )
        )
        await session.commit()
    return application_response(application, job)


@router.post("/applications/{application_id}/prepare", response_model=ApplicationMaterialsResponse, status_code=status.HTTP_201_CREATED)
async def prepare_application(
    application_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationMaterialsResponse:
    row = await session.execute(
        select(Application, Job)
        .join(Job, Application.job_id == Job.id)
        .where(Application.id == application_id, Application.user_id == user.id)
    )
    result = row.one_or_none()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    application, job = result
    profile = await ResumeService(session).get_active(user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Upload a master resume before preparing an application.")
    resume_content = {
        "draft_type": "evidence_grounded",
        "target_role": job.title,
        "target_company": job.company,
        "skills": list(profile.skills),
        "experience": [
            {"title": experience.title, "company": experience.company, "description": experience.description}
            for experience in profile.experiences
        ],
        "source_resume_id": str(profile.id),
    }
    resume_version = ResumeVersion(
        user_id=user.id,
        job_id=job.id,
        master_resume_id=profile.id,
        ats_score=0,
        resume_content=resume_content,
    )
    cover_letter = CoverLetter(
        user_id=user.id,
        job_id=job.id,
        content=build_cover_letter(job, profile),
    )
    previous_status = application.status
    application.status = ApplicationStatus.PREPARING
    session.add_all([resume_version, cover_letter])
    await session.flush()
    application.resume_version_id = resume_version.id
    application.cover_letter_id = cover_letter.id
    session.add(
        ApplicationEvent(
            application_id=application.id,
            event_type="materials_prepared",
            from_status=previous_status.value,
            to_status=ApplicationStatus.PREPARING.value,
            metadata_={"resume_version_id": str(resume_version.id), "cover_letter_id": str(cover_letter.id)},
        )
    )
    await session.commit()
    return ApplicationMaterialsResponse(
        application=application_response(application, job),
        resume_version_id=str(resume_version.id),
        ats_score=resume_version.ats_score,
        resume_content=resume_content,
        cover_letter_id=str(cover_letter.id),
        cover_letter=cover_letter.content,
    )


def build_cover_letter(job: Job, profile: ResumeProfile) -> str:
    skills = ", ".join(profile.skills[:5]) or "my relevant experience"
    experience = profile.experiences[0] if profile.experiences else None
    evidence = (
        f"In my role as {experience.title} at {experience.company}, {experience.description}"
        if experience
        else "My attached resume outlines the experience I would bring to the role."
    )
    return (
        f"Dear {job.company} hiring team,\n\n"
        f"I am interested in the {job.title} opportunity. My background includes {skills}. "
        f"{evidence}\n\n"
        "I would welcome the opportunity to discuss how my experience could support your team.\n\n"
        "Sincerely"
    )


def application_response(application: Application, job: Job) -> ApplicationResponse:
    created_at = application.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return ApplicationResponse(
        id=str(application.id),
        job_id=str(job.id),
        company=job.company,
        title=job.title,
        status=application.status.value,
        created_at=created_at.isoformat(),
    )


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
        experiences=[
            ResumeExperienceResponse(title=experience.title, company=experience.company, description=experience.description)
            for experience in profile.experiences
        ],
    )
