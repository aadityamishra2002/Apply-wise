from datetime import datetime, timedelta, timezone
from hashlib import sha256
import re
from secrets import token_urlsafe
from typing import Annotated
from uuid import UUID
from uuid import NAMESPACE_URL, uuid5

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.jobs.service import JobMatchingService, MatchingWeights
from app.application.jobs.ats import AtsAnalysisService, AtsWeights
from app.application.exports.service import ResumeExportService, download_filename
from app.application.applications.autofill import build_autofill_plan
from app.application.automation.adapters import build_dry_run_steps, capability_for_url, list_capabilities
from app.application.identity.service import is_expired
from app.application.retry import RetryPolicy
from app.application.resumes.service import MAX_RESUME_BYTES, ResumeProfile, ResumeService, ResumeValidationError, detect_skills
from app.application.tailoring.quality import find_unsupported_claims
from app.application.tailoring.service import GeminiTailoringService
from app.core.config import get_settings
from app.core.security import AccessTokenError, create_extension_token, decode_extension_token
from app.domain.jobs.entities import Job as ProviderJob
from app.infrastructure.db.models import Application, ApplicationEvent, ApplicationStatus, CoverLetter, ExtensionPairingCode, Interview, Job, JobMatch, JobPreference, ResumeVersion, Subscription, User
from app.infrastructure.db.session import get_session
from app.infrastructure.providers.factory import create_job_provider
from app.presentation.api_v1.auth import bearer_scheme, get_current_user, router as auth_router
from app.domain.identity.entities import UserRecord

router = APIRouter()
router.include_router(auth_router)
settings = get_settings()
provider = create_job_provider(settings)
matching_service = JobMatchingService(
    MatchingWeights(
        skills=settings.matching_skills_weight,
        keywords=settings.matching_keywords_weight,
        experience=settings.matching_experience_weight,
    )
)
ats_service = AtsAnalysisService(
    AtsWeights(
        keywords=settings.ats_keywords_weight,
        sections=settings.ats_sections_weight,
        formatting=settings.ats_formatting_weight,
        parse_readiness=settings.ats_parse_readiness_weight,
    )
)
tailoring_service = GeminiTailoringService(
    api_key=settings.gemini_api_key,
    model=settings.gemini_model,
    timeout_seconds=settings.gemini_timeout_seconds,
    retry_policy=RetryPolicy(
        max_attempts=settings.gemini_retry_attempts,
        base_delay_seconds=settings.gemini_retry_base_delay_seconds,
        max_delay_seconds=settings.gemini_retry_max_delay_seconds,
    ),
)
resume_export_service = ResumeExportService()


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
    ats_score: int
    ats_breakdown: dict[str, int]
    ats_recommendations: list[str]
    recommendation_summary: str
    recommendation_reasons: list[str]
    high_fit: bool
    approval_status: str
    saved: bool = False
    application_id: str | None = None


class JobApprovalRequest(BaseModel):
    approval_status: str = Field(pattern="^(review_required|approved|dismissed)$")


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
    education: list["ResumeEducationResponse"]
    certifications: list["ResumeCertificationResponse"]


class ResumeExperienceResponse(BaseModel):
    title: str
    company: str
    description: str


class ResumeEducationResponse(BaseModel):
    institution: str
    degree: str
    year: str | None


class ResumeCertificationResponse(BaseModel):
    name: str
    issuer: str | None
    year: str | None


class ApplicationResponse(BaseModel):
    id: str
    job_id: str
    company: str
    title: str
    status: str
    notes: str | None
    created_at: str
    applied_at: str | None


class ApplicationUpdateRequest(BaseModel):
    status: ApplicationStatus | None = None
    notes: str | None = Field(default=None, max_length=5000)


class ApplicationEventResponse(BaseModel):
    id: str
    event_type: str
    from_status: str | None
    to_status: str | None
    metadata: dict
    occurred_at: str


class InterviewRequest(BaseModel):
    interview_round: str = Field(min_length=1, max_length=120)
    scheduled_at: datetime
    notes: str | None = Field(default=None, max_length=5000)


class InterviewResponse(InterviewRequest):
    id: str


class InterviewUpdateRequest(BaseModel):
    interview_round: str | None = Field(default=None, min_length=1, max_length=120)
    scheduled_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=5000)


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
    provenance: str
    generation_status: str
    retry_attempts: int


class CoverLetterResponse(BaseModel):
    id: str
    content: str
    created_at: str


class CoverLetterUpdateRequest(BaseModel):
    content: str = Field(min_length=20, max_length=20_000)


class AssistedApplicationChecklistResponse(BaseModel):
    application_id: str
    duplicate_prevention: bool
    ats_approved: bool
    resume_prepared: bool
    resume_version_id: str | None
    cover_letter_prepared: bool
    cover_letter_id: str | None
    target_url: str
    manual_final_submission_required: bool = True


class ResumeVersionResponse(BaseModel):
    id: str
    job_id: str
    job_title: str
    company: str
    ats_score: float
    created_at: str


class ResumeVersionDetailResponse(ResumeVersionResponse):
    resume_content: dict


class ResumeVersionUpdateRequest(BaseModel):
    resume_content: dict


class AnalyticsSummaryResponse(BaseModel):
    total_applications: int
    interview_rate: float
    offer_rate: float
    status_counts: dict[str, int]


class SkillRecommendationResponse(BaseModel):
    skill: str
    mention_count: int
    approved_role_count: int
    high_fit_role_count: int
    reason: str


class AdminSummaryResponse(BaseModel):
    users: int
    applications: int
    jobs: int
    resume_versions: int
    cover_letters: int
    subscriptions: dict[str, int]


class JobPreferenceRequest(BaseModel):
    role_keywords: str = Field(default="", max_length=255)
    location: str = Field(default="", max_length=255)
    remote_only: bool = False


class JobPreferenceResponse(JobPreferenceRequest):
    pass


class ManualJobRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    company: str = Field(min_length=1, max_length=255)
    location: str = Field(default="Not specified", max_length=255)
    url: str = Field(min_length=1, max_length=1000)
    description: str = Field(min_length=40, max_length=50000)


class ExtensionPairingCodeResponse(BaseModel):
    code: str
    expires_at: str


class ExtensionPairingExchangeRequest(BaseModel):
    code: str = Field(min_length=8, max_length=200)


class ExtensionTokenResponse(BaseModel):
    extension_token: str
    token_type: str = "bearer"
    expires_in: int


class SubscriptionResponse(BaseModel):
    plan: str
    status: str
    owner_bypass: bool
    features: list[str]


class ProviderHealthResponse(BaseModel):
    name: str
    status: str
    last_checked_at: str | None
    last_result_count: int | None
    retry_attempts: int = 0
    last_error: str | None = None


class AutofillFieldResponse(BaseModel):
    field_key: str
    label: str
    value: str
    confidence: float
    source: str
    sensitive: bool
    requires_review: bool


class AutofillPlanResponse(BaseModel):
    application_id: str
    job_title: str
    company: str
    target_url: str
    fields: list[AutofillFieldResponse]
    warnings: list[str]
    manual_final_submission_required: bool = True


class ExtensionApplicationEventRequest(BaseModel):
    event_type: str = Field(pattern="^(autofill_previewed|autofill_attempted|resume_upload_attempted)$")
    metadata: dict = Field(default_factory=dict)


class AutomationCapabilityResponse(BaseModel):
    site_key: str
    site_name: str
    domains: list[str]
    capture_supported: bool
    autofill_supported: bool
    resume_upload_supported: bool
    dry_run_supported: bool
    manual_submit_required: bool


class AutomationDryRunStepResponse(BaseModel):
    order: int
    action: str
    description: str
    requires_user_review: bool


class ApplicationAutomationPlanResponse(BaseModel):
    application_id: str
    job_title: str
    company: str
    target_url: str
    capability: AutomationCapabilityResponse
    steps: list[AutomationDryRunStepResponse]
    warnings: list[str]
    manual_final_submission_required: bool = True


class ReviewBeforeApplyResponse(BaseModel):
    application_id: str
    job_title: str
    company: str
    target_url: str
    resume_prepared: bool
    cover_letter_prepared: bool
    autofill_fields: list[AutofillFieldResponse]
    missing_fields: list[str]
    quality_warnings: list[str]
    warnings: list[str]
    manual_final_submission_required: bool = True


async def get_extension_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UUID:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing extension token.")
    try:
        user_id = decode_extension_token(credentials.credentials, settings)
    except AccessTokenError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error)) from error
    user = await session.get(User, user_id)
    if not user or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is unavailable.")
    return user.id


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


@router.get("/health/features")
def feature_health() -> dict[str, bool]:
    return {
        "adzuna_enabled": settings.adzuna_enabled,
        "gemini_enabled": settings.gemini_enabled,
        "remotive_enabled": settings.remotive_enabled,
    }


@router.get("/health/providers", response_model=list[ProviderHealthResponse])
def provider_health() -> list[ProviderHealthResponse]:
    return [
        ProviderHealthResponse(
            name=item.name,
            status=item.status,
            last_checked_at=item.last_checked_at.isoformat() if item.last_checked_at else None,
            last_result_count=item.last_result_count,
            retry_attempts=item.retry_attempts,
            last_error=item.last_error,
        )
        for item in provider.health()
    ]


@router.get("/automation/capabilities", response_model=list[AutomationCapabilityResponse])
def automation_capabilities() -> list[AutomationCapabilityResponse]:
    return [automation_capability_response(capability) for capability in list_capabilities()]


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


@router.get("/analytics/summary", response_model=AnalyticsSummaryResponse)
async def analytics_summary(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AnalyticsSummaryResponse:
    rows = await session.execute(
        select(Application.status, func.count())
        .where(Application.user_id == user.id)
        .group_by(Application.status)
    )
    status_counts = {status.value: count for status, count in rows.all()}
    total = sum(status_counts.values())
    interviews = status_counts.get(ApplicationStatus.INTERVIEW.value, 0)
    offers = status_counts.get(ApplicationStatus.OFFER.value, 0)
    return AnalyticsSummaryResponse(
        total_applications=total,
        interview_rate=round((interviews / total) * 100, 1) if total else 0,
        offer_rate=round((offers / total) * 100, 1) if total else 0,
        status_counts={status.value: status_counts.get(status.value, 0) for status in ApplicationStatus},
    )


@router.get("/learning/skill-recommendations", response_model=list[SkillRecommendationResponse])
async def skill_recommendations(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[SkillRecommendationResponse]:
    rows = await session.execute(select(JobMatch).where(JobMatch.user_id == user.id))
    scores: dict[str, dict[str, int]] = {}
    for match in rows.scalars():
        for skill in match.missing_skills or []:
            normalized = str(skill).strip()
            if not normalized:
                continue
            bucket = scores.setdefault(normalized, {"mentions": 0, "approved": 0, "high_fit": 0})
            bucket["mentions"] += 1
            if match.approval_status == "approved":
                bucket["approved"] += 1
            if match.ats_score >= settings.ats_high_fit_threshold:
                bucket["high_fit"] += 1
    ranked = sorted(
        scores.items(),
        key=lambda item: (item[1]["approved"] * 3 + item[1]["high_fit"] * 2 + item[1]["mentions"], item[0].lower()),
        reverse=True,
    )
    return [
        SkillRecommendationResponse(
            skill=skill,
            mention_count=counts["mentions"],
            approved_role_count=counts["approved"],
            high_fit_role_count=counts["high_fit"],
            reason=recommendation_reason(skill, counts),
        )
        for skill, counts in ranked[:8]
    ]


@router.get("/jobs", response_model=list[JobResponse])
async def search_jobs(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    query: Annotated[str, Query(max_length=100)] = "",
    location: Annotated[str, Query(max_length=100)] = "",
) -> list[JobResponse]:
    profile = await ResumeService(session).get_active(user.id)
    if not profile:
        return []
    profile_skills = {skill.lower() for skill in profile.skills}
    profile_keywords = set(profile.extracted_text.lower().split())
    preferences = await get_or_create_job_preferences(session, user.id)
    effective_query = query.strip() or preferences.role_keywords
    effective_location = location.strip() or preferences.location
    try:
        jobs = provider.search_jobs(effective_query, effective_location)
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The job provider is temporarily unavailable. Please try again shortly.",
        ) from error
    if preferences.remote_only:
        jobs = [job for job in jobs if "remote" in f"{job.location} {job.description}".lower()]
    matches = matching_service.rank_jobs(jobs, profile_skills, profile_keywords)
    ats_results = {match.job.id: ats_service.analyze(match.job, profile) for match in matches}
    approvals: dict[UUID, str] = {}
    stored_job_ids: list[UUID] = []
    for match in matches:
        ats = ats_results[match.job.id]
        stored_job = await ensure_stored_job(session, match.job)
        stored_job_ids.append(stored_job.id)
        stored_match = await session.scalar(select(JobMatch).where(JobMatch.user_id == user.id, JobMatch.job_id == stored_job.id))
        if stored_match:
            stored_match.match_score = match.match_score
            stored_match.matching_skills = list(match.matching_skills)
            stored_match.missing_skills = list(match.missing_skills)
            stored_match.ats_score = ats.score
            stored_match.ats_breakdown = ats.breakdown
            stored_match.ats_recommendations = list(ats.recommendations)
            approvals[match.job.id] = stored_match.approval_status
        else:
            session.add(
                JobMatch(
                    user_id=user.id,
                    job_id=stored_job.id,
                    match_score=match.match_score,
                    matching_skills=list(match.matching_skills),
                    missing_skills=list(match.missing_skills),
                    ats_score=ats.score,
                    ats_breakdown=ats.breakdown,
                    ats_recommendations=list(ats.recommendations),
                )
            )
            approvals[match.job.id] = "review_required"
    await session.commit()
    applications = await saved_applications_by_job(session, user.id, stored_job_ids)
    return [
        job_response(match, ats_results[match.job.id], approvals[match.job.id], applications.get(match.job.id))
        for match in matches
    ]


@router.patch("/jobs/{job_id}/approval", response_model=dict[str, str])
async def update_job_approval(
    job_id: UUID,
    payload: JobApprovalRequest,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    match = await session.scalar(select(JobMatch).where(JobMatch.user_id == user.id, JobMatch.job_id == job_id))
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scored job not found.")
    match.approval_status = payload.approval_status
    await session.commit()
    return {"approval_status": match.approval_status}


@router.post("/jobs/manual", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def capture_manual_job(
    payload: ManualJobRequest,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> JobResponse:
    return await score_and_store_manual_job(session, user.id, payload)


@router.post("/extension/pairing-codes", response_model=ExtensionPairingCodeResponse, status_code=status.HTTP_201_CREATED)
async def create_extension_pairing_code(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ExtensionPairingCodeResponse:
    code = token_urlsafe(12)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.extension_pairing_expire_minutes)
    session.add(ExtensionPairingCode(user_id=user.id, code_hash=sha256(code.encode()).hexdigest(), expires_at=expires_at))
    await session.commit()
    return ExtensionPairingCodeResponse(code=code, expires_at=expires_at.isoformat())


@router.post("/extension/pair", response_model=ExtensionTokenResponse)
async def pair_extension(
    payload: ExtensionPairingExchangeRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ExtensionTokenResponse:
    now = datetime.now(timezone.utc)
    pairing = await session.scalar(select(ExtensionPairingCode).where(ExtensionPairingCode.code_hash == sha256(payload.code.strip().encode()).hexdigest()))
    if not pairing or pairing.used_at or is_expired(pairing.expires_at, now):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired pairing code.")
    pairing.used_at = now
    await session.commit()
    return ExtensionTokenResponse(
        extension_token=create_extension_token(pairing.user_id, settings),
        expires_in=settings.extension_token_expire_days * 24 * 60 * 60,
    )


@router.post("/extension/jobs/capture", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def capture_extension_job(
    payload: ManualJobRequest,
    user_id: Annotated[UUID, Depends(get_extension_user_id)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> JobResponse:
    return await score_and_store_manual_job(session, user_id, payload, create_application=True)


@router.get("/settings/job-preferences", response_model=JobPreferenceResponse)
async def get_job_preferences(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> JobPreferenceResponse:
    preferences = await get_or_create_job_preferences(session, user.id)
    return job_preference_response(preferences)


@router.put("/settings/job-preferences", response_model=JobPreferenceResponse)
async def update_job_preferences(
    payload: JobPreferenceRequest,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> JobPreferenceResponse:
    preferences = await get_or_create_job_preferences(session, user.id)
    preferences.role_keywords = payload.role_keywords.strip()
    preferences.location = payload.location.strip()
    preferences.remote_only = payload.remote_only
    await session.commit()
    return job_preference_response(preferences)


@router.get("/billing/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SubscriptionResponse:
    subscription = await session.scalar(select(Subscription).where(Subscription.user_id == user.id))
    if not subscription:
        subscription = Subscription(user_id=user.id)
        session.add(subscription)
        await session.commit()
    owner_bypass = user.role == "admin"
    return SubscriptionResponse(
        plan="owner" if owner_bypass else subscription.plan,
        status=subscription.status,
        owner_bypass=owner_bypass,
        features=subscription_features("owner" if owner_bypass else subscription.plan),
    )


@router.get("/admin/summary", response_model=AdminSummaryResponse)
async def admin_summary(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AdminSummaryResponse:
    require_admin(user)
    rows = await session.execute(select(Subscription.plan, func.count()).group_by(Subscription.plan))
    return AdminSummaryResponse(
        users=await count_rows(session, User),
        applications=await count_rows(session, Application),
        jobs=await count_rows(session, Job),
        resume_versions=await count_rows(session, ResumeVersion),
        cover_letters=await count_rows(session, CoverLetter),
        subscriptions={plan: count for plan, count in rows.all()},
    )


@router.post("/jobs/{job_id}/save", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def save_job(
    job_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationResponse:
    stored_job = await session.scalar(select(Job).where(Job.id == job_id))
    if not stored_job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    application = await session.scalar(select(Application).where(Application.user_id == user.id, Application.job_id == stored_job.id))
    if not application:
        application = Application(user_id=user.id, job_id=stored_job.id, status=ApplicationStatus.SAVED)
        session.add(application)
        await session.commit()
    return application_response(application, stored_job)


@router.get("/resume-versions", response_model=list[ResumeVersionResponse])
async def list_resume_versions(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ResumeVersionResponse]:
    rows = await session.execute(
        select(ResumeVersion, Job)
        .join(Job, ResumeVersion.job_id == Job.id)
        .where(ResumeVersion.user_id == user.id)
        .order_by(ResumeVersion.created_at.desc())
    )
    return [
        ResumeVersionResponse(
            id=str(version.id),
            job_id=str(job.id),
            job_title=job.title,
            company=job.company,
            ats_score=version.ats_score,
            created_at=version.created_at.isoformat(),
        )
        for version, job in rows.all()
    ]


@router.get("/resume-versions/{version_id}", response_model=ResumeVersionDetailResponse)
async def get_resume_version(
    version_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeVersionDetailResponse:
    version, job = await get_owned_resume_version_row(session, version_id, user.id)
    return resume_version_detail_response(version, job)


@router.patch("/resume-versions/{version_id}", response_model=ResumeVersionDetailResponse)
async def update_resume_version(
    version_id: UUID,
    payload: ResumeVersionUpdateRequest,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeVersionDetailResponse:
    version, job = await get_owned_resume_version_row(session, version_id, user.id)
    version.resume_content = validate_resume_version_content(payload.resume_content)
    await session.commit()
    return resume_version_detail_response(version, job)


@router.get("/resume-versions/{version_id}/download")
async def download_resume_version(
    version_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    format: Annotated[str, Query(pattern="^(docx|pdf)$")] = "docx",
) -> Response:
    version, job = await get_owned_resume_version_row(session, version_id, user.id)
    if format == "pdf":
        body = resume_export_service.build_pdf(version, job)
        media_type = "application/pdf"
    else:
        body = resume_export_service.build_docx(version, job)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return Response(
        body,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{download_filename(job, format)}"'},
    )


@router.get("/cover-letters/{cover_letter_id}/download")
async def download_cover_letter(
    cover_letter_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    row = await session.execute(
        select(CoverLetter, Job)
        .join(Job, CoverLetter.job_id == Job.id)
        .where(CoverLetter.id == cover_letter_id, CoverLetter.user_id == user.id)
    )
    result = row.one_or_none()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cover letter not found.")
    cover_letter, job = result
    filename = f"cover-letter-{slugify_filename(job.company)}-{slugify_filename(job.title)}.txt"
    return Response(
        cover_letter.content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/cover-letters/{cover_letter_id}", response_model=CoverLetterResponse)
async def get_cover_letter(
    cover_letter_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CoverLetterResponse:
    cover_letter = await session.scalar(select(CoverLetter).where(CoverLetter.id == cover_letter_id, CoverLetter.user_id == user.id))
    if not cover_letter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cover letter not found.")
    return cover_letter_response(cover_letter)


@router.patch("/cover-letters/{cover_letter_id}", response_model=CoverLetterResponse)
async def update_cover_letter(
    cover_letter_id: UUID,
    payload: CoverLetterUpdateRequest,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CoverLetterResponse:
    cover_letter = await session.scalar(select(CoverLetter).where(CoverLetter.id == cover_letter_id, CoverLetter.user_id == user.id))
    if not cover_letter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cover letter not found.")
    cover_letter.content = payload.content.strip()
    await session.commit()
    return cover_letter_response(cover_letter)


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
    if payload.status is not None and application.status != payload.status:
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
    if payload.notes is not None:
        application.notes = payload.notes.strip() or None
        session.add(ApplicationEvent(application_id=application.id, event_type="notes_updated"))
    await session.commit()
    return application_response(application, job)


@router.get("/applications/{application_id}/events", response_model=list[ApplicationEventResponse])
async def list_application_events(
    application_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ApplicationEventResponse]:
    application = await session.scalar(select(Application).where(Application.id == application_id, Application.user_id == user.id))
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    events = (
        await session.scalars(
            select(ApplicationEvent)
            .where(ApplicationEvent.application_id == application.id)
            .order_by(ApplicationEvent.occurred_at.desc())
        )
    ).all()
    return [
        ApplicationEventResponse(
            id=str(event.id),
            event_type=event.event_type,
            from_status=event.from_status,
            to_status=event.to_status,
            metadata=event.metadata_ or {},
            occurred_at=event.occurred_at.isoformat(),
        )
        for event in events
    ]


@router.get("/applications/{application_id}/assisted-checklist", response_model=AssistedApplicationChecklistResponse)
async def assisted_application_checklist(
    application_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AssistedApplicationChecklistResponse:
    row = await session.execute(
        select(Application, Job, JobMatch)
        .join(Job, Application.job_id == Job.id)
        .outerjoin(JobMatch, (JobMatch.job_id == Job.id) & (JobMatch.user_id == user.id))
        .where(Application.id == application_id, Application.user_id == user.id)
    )
    result = row.one_or_none()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    application, job, match = result
    return AssistedApplicationChecklistResponse(
        application_id=str(application.id),
        duplicate_prevention=True,
        ats_approved=bool(match and match.approval_status == "approved"),
        resume_prepared=application.resume_version_id is not None,
        resume_version_id=str(application.resume_version_id) if application.resume_version_id else None,
        cover_letter_prepared=application.cover_letter_id is not None,
        cover_letter_id=str(application.cover_letter_id) if application.cover_letter_id else None,
        target_url=job.url,
    )


@router.get("/applications/{application_id}/automation-plan", response_model=ApplicationAutomationPlanResponse)
async def application_automation_plan(
    application_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationAutomationPlanResponse:
    row = await session.execute(
        select(Application, Job)
        .join(Job, Application.job_id == Job.id)
        .where(Application.id == application_id, Application.user_id == user.id)
    )
    result = row.one_or_none()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    application, job = result
    capability = capability_for_url(job.url)
    steps = build_dry_run_steps(
        capability,
        has_resume=application.resume_version_id is not None,
        has_cover_letter=application.cover_letter_id is not None,
    )
    warnings = [
        "This is a dry-run/manual-submit plan. Apply Wise must stop before final submission.",
        "Review every field on the employer site before submitting manually.",
    ]
    if not capability.autofill_supported:
        warnings.append("This site currently requires manual field entry because assisted autofill is not enabled for the adapter.")
    if not application.resume_version_id:
        warnings.append("Prepare a tailored resume before using resume attachment assistance.")
    if not application.cover_letter_id:
        warnings.append("Prepare a cover letter before using cover-letter assistance.")
    session.add(
        ApplicationEvent(
            application_id=application.id,
            event_type="automation_dry_run_planned",
            metadata_={"site_key": capability.site_key, "manual_final_submission_required": True},
        )
    )
    await session.commit()
    return ApplicationAutomationPlanResponse(
        application_id=str(application.id),
        job_title=job.title,
        company=job.company,
        target_url=job.url,
        capability=automation_capability_response(capability),
        steps=[AutomationDryRunStepResponse(**step.__dict__) for step in steps],
        warnings=warnings,
    )


@router.get("/applications/{application_id}/review-before-apply", response_model=ReviewBeforeApplyResponse)
async def review_before_apply(
    application_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ReviewBeforeApplyResponse:
    row = await session.execute(
        select(Application, Job, ResumeVersion, CoverLetter)
        .join(Job, Application.job_id == Job.id)
        .outerjoin(ResumeVersion, Application.resume_version_id == ResumeVersion.id)
        .outerjoin(CoverLetter, Application.cover_letter_id == CoverLetter.id)
        .where(Application.id == application_id, Application.user_id == user.id)
    )
    result = row.one_or_none()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    application, job, resume_version, cover_letter = result
    profile = await ResumeService(session).get_active(user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Upload a master resume before reviewing an application.")
    db_user = await session.get(User, user.id)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is unavailable.")
    fields = build_autofill_plan(user=db_user, profile=profile, job=job, resume_version=resume_version, cover_letter=cover_letter)
    quality_warnings = [
        warning.message
        for warning in find_unsupported_claims(
            resume_version.resume_content if resume_version else None,
            cover_letter.content if cover_letter else None,
            profile,
        )
    ]
    missing_fields = [field.label for field in fields if not field.value or field.requires_review or field.confidence < 0.75]
    if not resume_version:
        missing_fields.append("Tailored resume")
    if not cover_letter:
        missing_fields.append("Cover letter")
    warnings = [
        "Review every generated claim and employer form field before applying.",
        "Apply Wise does not submit the application automatically.",
    ]
    if missing_fields:
        warnings.append("Some fields need manual confirmation before employer-page submission.")
    if quality_warnings:
        warnings.append("Unsupported generated claims need review before download or employer submission.")
    session.add(
        ApplicationEvent(
            application_id=application.id,
            event_type="review_before_apply_opened",
            metadata_={"missing_field_count": len(missing_fields), "quality_warning_count": len(quality_warnings), "manual_final_submission_required": True},
        )
    )
    await session.commit()
    return ReviewBeforeApplyResponse(
        application_id=str(application.id),
        job_title=job.title,
        company=job.company,
        target_url=job.url,
        resume_prepared=resume_version is not None,
        cover_letter_prepared=cover_letter is not None,
        autofill_fields=[AutofillFieldResponse(**field.__dict__) for field in fields],
        missing_fields=dedupe_preserve_order(missing_fields),
        quality_warnings=quality_warnings,
        warnings=warnings,
    )


@router.get("/applications/{application_id}/interviews", response_model=list[InterviewResponse])
async def list_interviews(
    application_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[InterviewResponse]:
    application = await get_owned_application(session, application_id, user.id)
    interviews = (
        await session.scalars(
            select(Interview).where(Interview.application_id == application.id).order_by(Interview.scheduled_at)
        )
    ).all()
    return [interview_response(interview) for interview in interviews]


@router.post("/applications/{application_id}/interviews", response_model=InterviewResponse, status_code=status.HTTP_201_CREATED)
async def create_interview(
    application_id: UUID,
    payload: InterviewRequest,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InterviewResponse:
    application = await get_owned_application(session, application_id, user.id)
    interview = Interview(
        application_id=application.id,
        interview_round=payload.interview_round.strip(),
        scheduled_at=payload.scheduled_at,
        notes=payload.notes.strip() if payload.notes else None,
    )
    application.status = ApplicationStatus.INTERVIEW
    session.add_all([interview, ApplicationEvent(application_id=application.id, event_type="interview_scheduled", to_status=ApplicationStatus.INTERVIEW.value)])
    await session.commit()
    return interview_response(interview)


@router.patch("/applications/{application_id}/interviews/{interview_id}", response_model=InterviewResponse)
async def update_interview(
    application_id: UUID,
    interview_id: UUID,
    payload: InterviewUpdateRequest,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InterviewResponse:
    application = await get_owned_application(session, application_id, user.id)
    interview = await get_application_interview(session, application.id, interview_id)
    if payload.interview_round is not None:
        interview.interview_round = payload.interview_round.strip()
    if payload.scheduled_at is not None:
        interview.scheduled_at = payload.scheduled_at
    if payload.notes is not None:
        interview.notes = payload.notes.strip() or None
    session.add(ApplicationEvent(application_id=application.id, event_type="interview_updated"))
    await session.commit()
    return interview_response(interview)


@router.delete("/applications/{application_id}/interviews/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interview(
    application_id: UUID,
    interview_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    application = await get_owned_application(session, application_id, user.id)
    interview = await get_application_interview(session, application.id, interview_id)
    await session.delete(interview)
    session.add(ApplicationEvent(application_id=application.id, event_type="interview_removed"))
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
    materials = tailoring_service.prepare(job, profile)
    stored_match = await session.scalar(select(JobMatch).where(JobMatch.user_id == user.id, JobMatch.job_id == job.id))
    resume_content = materials.resume_content
    resume_version = ResumeVersion(
        user_id=user.id,
        job_id=job.id,
        master_resume_id=profile.id,
        ats_score=stored_match.ats_score if stored_match else 0,
        resume_content=resume_content,
    )
    cover_letter = CoverLetter(
        user_id=user.id,
        job_id=job.id,
        content=materials.cover_letter,
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
        provenance=materials.provenance,
        generation_status=materials.generation_status,
        retry_attempts=materials.retry_attempts,
    )


async def ensure_stored_job(session: AsyncSession, matched_job: ProviderJob) -> Job:
    stored_job = await session.scalar(select(Job).where(Job.source == matched_job.source, Job.external_id == matched_job.external_id))
    if stored_job:
        return stored_job
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
    return stored_job


async def get_or_create_job_preferences(session: AsyncSession, user_id: UUID) -> JobPreference:
    preferences = await session.scalar(select(JobPreference).where(JobPreference.user_id == user_id))
    if preferences:
        return preferences
    preferences = JobPreference(user_id=user_id)
    session.add(preferences)
    await session.flush()
    return preferences


async def get_owned_application(session: AsyncSession, application_id: UUID, user_id: UUID) -> Application:
    application = await session.scalar(select(Application).where(Application.id == application_id, Application.user_id == user_id))
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    return application


async def get_application_interview(session: AsyncSession, application_id: UUID, interview_id: UUID) -> Interview:
    interview = await session.scalar(select(Interview).where(Interview.id == interview_id, Interview.application_id == application_id))
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found.")
    return interview


def interview_response(interview: Interview) -> InterviewResponse:
    return InterviewResponse(
        id=str(interview.id),
        interview_round=interview.interview_round,
        scheduled_at=interview.scheduled_at,
        notes=interview.notes,
    )


def job_preference_response(preferences: JobPreference) -> JobPreferenceResponse:
    return JobPreferenceResponse(
        role_keywords=preferences.role_keywords,
        location=preferences.location,
        remote_only=preferences.remote_only,
    )


def automation_capability_response(capability) -> AutomationCapabilityResponse:
    return AutomationCapabilityResponse(
        site_key=capability.site_key,
        site_name=capability.site_name,
        domains=list(capability.domains),
        capture_supported=capability.capture_supported,
        autofill_supported=capability.autofill_supported,
        resume_upload_supported=capability.resume_upload_supported,
        dry_run_supported=capability.dry_run_supported,
        manual_submit_required=capability.manual_submit_required,
    )


def subscription_features(plan: str) -> list[str]:
    if plan in {"owner", "pro"}:
        return ["unlimited_job_discovery", "gemini_tailoring", "resume_exports", "application_tracking", "analytics"]
    return ["job_discovery", "safe_tailoring", "resume_exports", "application_tracking"]


def recommendation_reason(skill: str, counts: dict[str, int]) -> str:
    if counts["approved"]:
        return f"{skill} appears in roles you approved for application prep."
    if counts["high_fit"]:
        return f"{skill} appears in high-ATS roles that are close to your profile."
    return f"{skill} appears repeatedly in matched roles but is missing from your resume evidence."


def dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        normalized = value.strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(value)
    return result


async def score_and_store_manual_job(session: AsyncSession, user_id: UUID, payload: ManualJobRequest, create_application: bool = False) -> JobResponse:
    profile = await ResumeService(session).get_active(user_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Upload a master resume before capturing a job.")
    external_id = sha256(payload.url.strip().encode()).hexdigest()
    job = ProviderJob(
        id=uuid5(NAMESPACE_URL, f"jobcopilot:manual:{external_id}"),
        external_id=external_id,
        source="manual",
        title=payload.title.strip(),
        company=payload.company.strip(),
        location=payload.location.strip() or "Not specified",
        description=payload.description.strip(),
        required_skills=frozenset(skill for skill, _ in detect_skills(payload.description)),
        url=payload.url.strip(),
        work_mode="Not specified",
    )
    match = matching_service.rank_jobs([job], {skill.lower() for skill in profile.skills}, set(profile.extracted_text.lower().split()))[0]
    ats = ats_service.analyze(job, profile)
    stored_job = await ensure_stored_job(session, job)
    stored_match = await session.scalar(select(JobMatch).where(JobMatch.user_id == user_id, JobMatch.job_id == stored_job.id))
    if stored_match:
        stored_match.match_score = match.match_score
        stored_match.matching_skills = list(match.matching_skills)
        stored_match.missing_skills = list(match.missing_skills)
        stored_match.ats_score = ats.score
        stored_match.ats_breakdown = ats.breakdown
        stored_match.ats_recommendations = list(ats.recommendations)
    else:
        session.add(JobMatch(user_id=user_id, job_id=stored_job.id, match_score=match.match_score, matching_skills=list(match.matching_skills), missing_skills=list(match.missing_skills), ats_score=ats.score, ats_breakdown=ats.breakdown, ats_recommendations=list(ats.recommendations)))
    application = await session.scalar(select(Application).where(Application.user_id == user_id, Application.job_id == stored_job.id))
    if create_application and not application:
        application = Application(user_id=user_id, job_id=stored_job.id)
        session.add(application)
        await session.flush()
        session.add(
            ApplicationEvent(
                application_id=application.id,
                event_type="extension_job_captured",
                metadata_={"source_url": payload.url.strip(), "manual_final_submission_required": True},
            )
        )
    elif create_application and application:
        session.add(
            ApplicationEvent(
                application_id=application.id,
                event_type="extension_job_recaptured",
                metadata_={"source_url": payload.url.strip(), "manual_final_submission_required": True},
            )
        )
    await session.commit()
    applications = await saved_applications_by_job(session, user_id, [stored_job.id])
    return job_response(match, ats, stored_match.approval_status if stored_match else "review_required", applications.get(stored_job.id))


@router.get("/extension/applications/{application_id}/autofill-plan", response_model=AutofillPlanResponse)
async def extension_autofill_plan(
    application_id: UUID,
    user_id: Annotated[UUID, Depends(get_extension_user_id)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AutofillPlanResponse:
    row = await session.execute(
        select(Application, Job, ResumeVersion, CoverLetter)
        .join(Job, Application.job_id == Job.id)
        .outerjoin(ResumeVersion, Application.resume_version_id == ResumeVersion.id)
        .outerjoin(CoverLetter, Application.cover_letter_id == CoverLetter.id)
        .where(Application.id == application_id, Application.user_id == user_id)
    )
    result = row.one_or_none()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    application, job, resume_version, cover_letter = result
    profile = await ResumeService(session).get_active(user_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Upload a master resume before assisted autofill.")
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is unavailable.")
    fields = build_autofill_plan(user=user, profile=profile, job=job, resume_version=resume_version, cover_letter=cover_letter)
    warnings = [
        "Review every field before filling. Apply Wise will never submit the application automatically.",
        "Low-confidence and sensitive fields are unchecked by default in the extension.",
    ]
    if not resume_version:
        warnings.append("Prepare a tailored resume before using resume upload assistance.")
    if not cover_letter:
        warnings.append("Prepare a cover letter before filling cover-letter fields.")
    session.add(
        ApplicationEvent(
            application_id=application.id,
            event_type="autofill_previewed",
            metadata_={"field_count": len(fields), "manual_final_submission_required": True},
        )
    )
    await session.commit()
    return AutofillPlanResponse(
        application_id=str(application.id),
        job_title=job.title,
        company=job.company,
        target_url=job.url,
        fields=[AutofillFieldResponse(**field.__dict__) for field in fields],
        warnings=warnings,
    )


@router.post("/extension/applications/{application_id}/events", status_code=status.HTTP_201_CREATED)
async def record_extension_application_event(
    application_id: UUID,
    payload: ExtensionApplicationEventRequest,
    user_id: Annotated[UUID, Depends(get_extension_user_id)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    application = await session.scalar(select(Application).where(Application.id == application_id, Application.user_id == user_id))
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    metadata = dict(payload.metadata)
    metadata["manual_final_submission_required"] = True
    session.add(ApplicationEvent(application_id=application.id, event_type=payload.event_type, metadata_=metadata))
    await session.commit()
    return {"status": "recorded"}


@router.get("/extension/applications/{application_id}/resume-download")
async def extension_download_application_resume(
    application_id: UUID,
    user_id: Annotated[UUID, Depends(get_extension_user_id)],
    session: Annotated[AsyncSession, Depends(get_session)],
    format: str = Query(default="pdf", pattern="^(docx|pdf)$"),
) -> Response:
    row = await session.execute(
        select(Application, Job, ResumeVersion)
        .join(Job, Application.job_id == Job.id)
        .join(ResumeVersion, Application.resume_version_id == ResumeVersion.id)
        .where(Application.id == application_id, Application.user_id == user_id)
    )
    result = row.one_or_none()
    if not result:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Prepare a tailored resume before downloading it from the extension.")
    application, job, version = result
    if format == "pdf":
        body = resume_export_service.build_pdf(version, job)
        media_type = "application/pdf"
    else:
        body = resume_export_service.build_docx(version, job)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    session.add(
        ApplicationEvent(
            application_id=application.id,
            event_type="resume_downloaded_for_upload",
            metadata_={"format": format, "manual_final_submission_required": True},
        )
    )
    await session.commit()
    return Response(
        content=body,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{download_filename(job, format)}"'},
    )


async def saved_applications_by_job(session: AsyncSession, user_id: UUID, job_ids: list[UUID]) -> dict[UUID, Application]:
    if not job_ids:
        return {}
    rows = await session.execute(select(Application).where(Application.user_id == user_id, Application.job_id.in_(job_ids)))
    return {application.job_id: application for application in rows.scalars()}


def job_response(match, ats, approval_status: str = "review_required", application: Application | None = None) -> JobResponse:
    reasons = recommendation_reasons(match, ats)
    return JobResponse(
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
        ats_score=ats.score,
        ats_breakdown=ats.breakdown,
        ats_recommendations=list(ats.recommendations),
        recommendation_summary=reasons[0],
        recommendation_reasons=reasons,
        high_fit=ats.score >= settings.ats_high_fit_threshold,
        approval_status=approval_status,
        saved=application is not None,
        application_id=str(application.id) if application else None,
    )


def recommendation_reasons(match, ats) -> list[str]:
    reasons: list[str] = []
    if match.matching_skills:
        skills = ", ".join(list(match.matching_skills)[:5])
        reasons.append(f"Matches your resume skills: {skills}.")
    if ats.score >= settings.ats_high_fit_threshold:
        reasons.append(f"ATS readiness is {ats.score}%, above the {settings.ats_high_fit_threshold}% review threshold.")
    elif ats.score >= 65:
        reasons.append(f"ATS readiness is {ats.score}%, but a few missing keywords may need review.")
    else:
        reasons.append(f"ATS readiness is {ats.score}%, so review missing keywords before applying.")
    if match.missing_skills:
        missing = ", ".join(list(match.missing_skills)[:4])
        reasons.append(f"Missing or unverified skills from the job: {missing}.")
    if match.experience_match >= 95:
        reasons.append("Seniority appears aligned with your current resume evidence.")
    else:
        reasons.append("Seniority may be slightly above the current resume evidence.")
    return reasons


def application_response(application: Application, job: Job) -> ApplicationResponse:
    created_at = application.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    applied_at = application.applied_at
    if applied_at and applied_at.tzinfo is None:
        applied_at = applied_at.replace(tzinfo=timezone.utc)
    return ApplicationResponse(
        id=str(application.id),
        job_id=str(job.id),
        company=job.company,
        title=job.title,
        status=application.status.value,
        notes=application.notes,
        created_at=created_at.isoformat(),
        applied_at=applied_at.isoformat() if applied_at else None,
    )


async def get_owned_resume_version_row(session: AsyncSession, version_id: UUID, user_id: UUID) -> tuple[ResumeVersion, Job]:
    row = await session.execute(
        select(ResumeVersion, Job)
        .join(Job, ResumeVersion.job_id == Job.id)
        .where(ResumeVersion.id == version_id, ResumeVersion.user_id == user_id)
    )
    result = row.one_or_none()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume version not found.")
    return result


def resume_version_detail_response(version: ResumeVersion, job: Job) -> ResumeVersionDetailResponse:
    created_at = version.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return ResumeVersionDetailResponse(
        id=str(version.id),
        job_id=str(job.id),
        job_title=job.title,
        company=job.company,
        ats_score=version.ats_score,
        created_at=created_at.isoformat(),
        resume_content=version.resume_content,
    )


def validate_resume_version_content(content: dict) -> dict:
    if not isinstance(content.get("skills"), list):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Resume content must include a skills list.")
    if not isinstance(content.get("experience"), list):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Resume content must include an experience list.")
    cleaned = dict(content)
    cleaned["professional_summary"] = str(content.get("professional_summary", "")).strip()[:1200]
    cleaned["skills"] = [str(skill).strip()[:120] for skill in content["skills"] if str(skill).strip()]
    cleaned["experience"] = [
        {
            "title": str(experience.get("title", "")).strip()[:255],
            "company": str(experience.get("company", "")).strip()[:255],
            "description": str(experience.get("description", "")).strip()[:4000],
        }
        for experience in content["experience"]
        if isinstance(experience, dict)
    ]
    if not cleaned["experience"]:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Resume content must include at least one experience entry.")
    return cleaned


def cover_letter_response(cover_letter: CoverLetter) -> CoverLetterResponse:
    created_at = cover_letter.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return CoverLetterResponse(
        id=str(cover_letter.id),
        content=cover_letter.content,
        created_at=created_at.isoformat(),
    )


def slugify_filename(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:80] or "application"


def require_admin(user: UserRecord) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")


async def count_rows(session: AsyncSession, model) -> int:
    return await session.scalar(select(func.count()).select_from(model)) or 0


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
        education=[
            ResumeEducationResponse(institution=item.institution, degree=item.degree, year=item.year)
            for item in profile.education
        ],
        certifications=[
            ResumeCertificationResponse(name=item.name, issuer=item.issuer, year=item.year)
            for item in profile.certifications
        ],
    )
