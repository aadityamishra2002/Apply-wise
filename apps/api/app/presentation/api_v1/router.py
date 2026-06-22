from datetime import datetime, timedelta, timezone
from hashlib import sha256
from html.parser import HTMLParser
import ipaddress
import json
from pathlib import Path
import re
from secrets import token_urlsafe
from types import SimpleNamespace
from typing import Annotated
from urllib.parse import urlparse
from uuid import UUID
from uuid import NAMESPACE_URL, uuid5

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_, select, text, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.jobs.service import JobMatchingService, MatchingWeights
from app.application.jobs.ats import AtsAnalysisService, AtsResult, AtsWeights
from app.application.exports.service import ResumeExportService, download_filename, extract_placeholders_from_docx
from app.application.applications.autofill import build_autofill_plan
from app.application.automation.adapters import build_dry_run_steps, capability_for_url, list_capabilities
from app.application.identity.service import is_expired
from app.application.retry import RetryPolicy, run_with_retries
from app.application.resumes.service import MAX_RESUME_BYTES, ResumeCertification, ResumeEducation, ResumeExperience, ResumeProfile, ResumeProject, ResumeService, ResumeValidationError, detect_skills
from app.application.tailoring.quality import find_unsupported_claims
from app.application.tailoring.service import GeminiTailoringService, TailoredMaterials, build_fallback_materials
from app.core.config import get_settings
from app.core.security import AccessTokenError, create_extension_token, decode_extension_token
from app.domain.jobs.entities import Job as ProviderJob
from app.infrastructure.db.models import ActivityLog, Application, ApplicationEvent, ApplicationStatus, AutomationRun, BackgroundJob, CoverLetter, ExtensionPairingCode, Interview, Job, JobMatch, JobPreference, ResumeTemplate, ResumeVersion, Subscription, User, UserProfile
from app.infrastructure.db.session import get_session, session_factory
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
export_retry_policy = RetryPolicy(
    max_attempts=settings.export_retry_attempts,
    base_delay_seconds=settings.export_retry_base_delay_seconds,
    max_delay_seconds=settings.export_retry_max_delay_seconds,
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
    projects: list["ResumeProjectResponse"]


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


class ResumeProjectResponse(BaseModel):
    name: str
    description: str
    technologies: list[str]


class ResumeExperienceUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    company: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=5000)


class ResumeEducationUpdateRequest(BaseModel):
    institution: str = Field(min_length=1, max_length=255)
    degree: str = Field(min_length=1, max_length=255)
    year: str | None = Field(default=None, max_length=32)


class ResumeCertificationUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    issuer: str | None = Field(default=None, max_length=255)
    year: str | None = Field(default=None, max_length=32)


class ResumeProjectUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=5000)
    technologies: list[str] = Field(default_factory=list, max_length=30)


class ResumeProfileUpdateRequest(BaseModel):
    skills: list[str] = Field(default_factory=list, max_length=200)
    experiences: list[ResumeExperienceUpdateRequest] = Field(default_factory=list, max_length=50)
    education: list[ResumeEducationUpdateRequest] = Field(default_factory=list, max_length=50)
    certifications: list[ResumeCertificationUpdateRequest] = Field(default_factory=list, max_length=50)
    projects: list[ResumeProjectUpdateRequest] = Field(default_factory=list, max_length=50)


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
    manual_submission_confirmed: bool = False


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
    applied_applications: int
    captured_jobs: int
    average_match_score: float | None
    weekly_activity: list[int]
    has_resume: bool
    has_extension_pairing: bool
    has_application_profile: bool
    prepared_applications: int
    reviewed_applications: int


class ActivityLogResponse(BaseModel):
    id: str
    event_type: str
    metadata: dict
    created_at: str


class ApplicationMaterialsResponse(BaseModel):
    application: ApplicationResponse
    application_status: str
    resume_version_id: str
    template_id: str | None
    template_name: str
    ats_score: float
    resume_content: dict
    cover_letter_id: str
    cover_letter: str
    matching_skills: list[str]
    missing_skills: list[str]
    provenance: str
    generation_status: str
    retry_attempts: int


class CoverLetterResponse(BaseModel):
    id: str
    job_id: str
    content: str
    ats_score: float
    prompt_version: str
    model_provider: str
    model_name: str
    generation_status: str
    quality_warnings: list[str] = []
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
    review_confirmed: bool
    autofill_supported: bool
    resume_upload_supported: bool
    ready_for_assisted_apply: bool
    blocking_reasons: list[str]
    next_steps: list[str]
    target_url: str
    manual_final_submission_required: bool = True


class ResumeVersionResponse(BaseModel):
    id: str
    job_id: str
    job_title: str
    company: str
    ats_score: float
    template_id: str | None = None
    template_name: str
    prompt_version: str
    model_provider: str
    model_name: str
    generation_status: str
    created_at: str


class ResumeVersionDetailResponse(ResumeVersionResponse):
    resume_content: dict
    quality_warnings: list[str] = []
    ats_improvement_suggestions: list[str] = []
    missing_skills_analysis: list[str] = []
    matching_skills: list[str] = []


class ResumeVersionUpdateRequest(BaseModel):
    resume_content: dict


class ResumeTemplateResponse(BaseModel):
    id: str
    name: str
    source: str
    original_filename: str | None = None
    placeholders: list[str]
    is_active: bool
    created_at: str | None = None


class ResumeTemplateUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class ResumeTemplatePreviewResponse(BaseModel):
    template: ResumeTemplateResponse
    section_order: list[str]
    missing_placeholders: list[str]
    preview: dict[str, list[str]]


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


class UserProfileRequest(BaseModel):
    full_name: str = Field(default="", max_length=255)
    phone: str = Field(default="", max_length=64)
    location: str = Field(default="", max_length=255)
    linkedin_url: str = Field(default="", max_length=500)
    github_url: str = Field(default="", max_length=500)
    portfolio_url: str = Field(default="", max_length=500)

    @field_validator("linkedin_url", "github_url", "portfolio_url")
    @classmethod
    def validate_profile_url(cls, value: str) -> str:
        cleaned = value.strip()
        if cleaned and not cleaned.startswith(("https://", "http://")):
            raise ValueError("Enter a full URL starting with https:// or http://.")
        return cleaned


class UserProfileResponse(UserProfileRequest):
    pass


class ManualJobRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    company: str = Field(min_length=1, max_length=255)
    location: str = Field(default="Not specified", max_length=255)
    url: str = Field(min_length=1, max_length=1000)
    description: str = Field(min_length=40, max_length=50000)


class JobUrlImportRequest(BaseModel):
    url: str = Field(min_length=8, max_length=1000)


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
    event_type: str = Field(pattern="^(autofill_previewed|autofill_approved|autofill_attempted|autofill_failed|form_inspection_failed|resume_upload_attempted|resume_upload_failed)$")
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


class AutomationRunResponse(BaseModel):
    id: str
    application_id: str
    site_key: str
    status: str
    current_step: str | None
    warnings: list[str]
    result: dict
    manual_final_submission_required: bool
    created_at: str
    updated_at: str


class BackgroundJobResponse(BaseModel):
    id: str
    job_type: str
    status: str
    attempts: int
    payload: dict
    result: dict
    error_message: str | None
    created_at: str
    updated_at: str
    completed_at: str | None


class ReviewBeforeApplyResponse(BaseModel):
    application_id: str
    application_status: str
    job_id: str
    job_title: str
    company: str
    location: str
    source: str
    target_url: str
    match_score: float | None
    ats_score: float | None
    matching_skills: list[str]
    missing_skills: list[str]
    template_id: str | None
    template_name: str
    resume_version_id: str | None
    cover_letter_id: str | None
    resume_summary: str | None
    cover_letter_preview: str | None
    resume_prepared: bool
    cover_letter_prepared: bool
    autofill_fields: list[AutofillFieldResponse]
    missing_fields: list[str]
    quality_warnings: list[str]
    warnings: list[str]
    review_confirmed: bool
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
    applied_applications = await session.scalar(
        select(func.count()).select_from(Application).where(
            Application.user_id == user.id,
            Application.status.in_([ApplicationStatus.APPLIED, ApplicationStatus.INTERVIEW, ApplicationStatus.OFFER]),
        )
    )
    captured_jobs = await session.scalar(
        select(func.count()).select_from(ActivityLog).where(
            ActivityLog.user_id == user.id,
            ActivityLog.event_type.in_(["job_captured", "extension_job_captured"]),
        )
    )
    has_resume = await ResumeService(session).get_active(user.id) is not None
    has_extension_pairing = bool(
        await session.scalar(
            select(func.count())
            .select_from(ExtensionPairingCode)
            .where(ExtensionPairingCode.user_id == user.id, ExtensionPairingCode.used_at.is_not(None))
        )
    )
    user_profile = await session.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    has_application_profile = bool(user_profile and (user_profile.full_name or user_profile.phone or user_profile.linkedin_url or user_profile.github_url or user_profile.portfolio_url))
    prepared_applications = await session.scalar(
        select(func.count()).select_from(Application).where(
            Application.user_id == user.id,
            Application.resume_version_id.is_not(None),
            Application.cover_letter_id.is_not(None),
        )
    )
    reviewed_applications = await session.scalar(
        select(func.count(func.distinct(ApplicationEvent.application_id)))
        .select_from(ApplicationEvent)
        .join(Application, Application.id == ApplicationEvent.application_id)
        .where(Application.user_id == user.id, ApplicationEvent.event_type == "review_before_apply_confirmed")
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
        applied_applications=applied_applications or 0,
        captured_jobs=captured_jobs or 0,
        average_match_score=round(float(average_match_score), 1) if average_match_score is not None else None,
        weekly_activity=weekly_activity,
        has_resume=has_resume,
        has_extension_pairing=has_extension_pairing,
        has_application_profile=has_application_profile,
        prepared_applications=prepared_applications or 0,
        reviewed_applications=reviewed_applications or 0,
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
    log_activity(
        session,
        user.id,
        "job_search_scored",
        {
            "query": effective_query,
            "location": effective_location,
            "result_count": len(matches),
            "high_fit_count": sum(1 for ats in ats_results.values() if ats.score >= settings.ats_high_fit_threshold),
            "remote_only": preferences.remote_only,
        },
    )
    await session.commit()
    applications = await saved_applications_by_job(session, user.id, stored_job_ids)
    responses = [
        job_response(match, ats_results[match.job.id], approvals[match.job.id], applications.get(match.job.id))
        for match in matches
    ]
    responses.extend(
        await stored_scored_job_responses(
            session,
            user.id,
            exclude_job_ids=set(stored_job_ids),
            query=effective_query,
            location=effective_location,
        )
    )
    return responses


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


@router.post("/jobs/import-url", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def import_job_url(
    payload: JobUrlImportRequest,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> JobResponse:
    url = validate_public_job_url(payload.url)
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            response = await client.get(
                url,
                headers={
                    "User-Agent": "ApplyWiseBot/1.0 (+https://apply-wise-1.vercel.app)",
                    "Accept": "text/html,application/xhtml+xml",
                },
            )
            response.raise_for_status()
    except httpx.HTTPError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not fetch this job page. Paste the job details manually or use the extension.") from error
    content_type = response.headers.get("content-type", "")
    if "html" not in content_type.lower():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="This URL did not return an HTML job page.")
    extracted = extract_job_from_html(str(response.url), response.text)
    return await score_and_store_manual_job(session, user.id, extracted, source="url_import")


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
    payload: dict,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> JobResponse | JSONResponse:
    if not credentials:
        return extension_error_response(
            status.HTTP_401_UNAUTHORIZED,
            "missing_extension_token",
            "Pair the extension from Apply Wise Settings before sending a job.",
            {"authorization": "missing"},
        )
    try:
        user_id = decode_extension_token(credentials.credentials, settings)
    except AccessTokenError as error:
        return extension_error_response(
            status.HTTP_401_UNAUTHORIZED,
            "expired_extension_token" if "expired" in str(error).lower() else "invalid_extension_token",
            "The extension pairing token is invalid or expired. Generate a fresh pairing code in Apply Wise Settings.",
            {"token_error": str(error)},
        )
    user = await session.get(User, user_id)
    if not user or user.status != "active":
        return extension_error_response(
            status.HTTP_401_UNAUTHORIZED,
            "invalid_extension_token",
            "The paired Apply Wise account is unavailable. Pair the extension again.",
            {"user_status": user.status if user else "missing"},
        )
    validation_error = validate_extension_capture_payload(payload)
    if isinstance(validation_error, JSONResponse):
        return validation_error
    try:
        return await score_and_store_manual_job(session, user_id, validation_error, create_application=True)
    except HTTPException as error:
        await session.rollback()
        detail = str(error.detail)
        if error.status_code == status.HTTP_409_CONFLICT and "Upload a master resume" in detail:
            return extension_error_response(
                status.HTTP_409_CONFLICT,
                "missing_resume",
                "Upload a master resume in Apply Wise before capturing LinkedIn jobs.",
                {"action": "upload_resume"},
            )
        return extension_error_response(
            error.status_code,
            "capture_failed",
            detail,
            {"status_code": error.status_code},
        )
    except SQLAlchemyError as error:
        await session.rollback()
        return extension_error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "database_error",
            "Apply Wise could not save this captured job. Please try again.",
            {"error": error.__class__.__name__},
        )


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


@router.get("/settings/profile", response_model=UserProfileResponse)
async def get_user_profile(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserProfileResponse:
    profile = await get_or_create_user_profile(session, user.id)
    return user_profile_response(profile)


@router.put("/settings/profile", response_model=UserProfileResponse)
async def update_user_profile(
    payload: UserProfileRequest,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserProfileResponse:
    profile = await get_or_create_user_profile(session, user.id)
    profile.full_name = payload.full_name.strip()
    profile.phone = payload.phone.strip()
    profile.location = payload.location.strip()
    profile.linkedin_url = payload.linkedin_url.strip()
    profile.github_url = payload.github_url.strip()
    profile.portfolio_url = payload.portfolio_url.strip()
    await session.commit()
    log_activity(session, user.id, "profile_updated", {"has_phone": bool(profile.phone), "has_links": bool(profile.linkedin_url or profile.github_url or profile.portfolio_url)})
    await session.commit()
    return user_profile_response(profile)


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


@router.get("/activity/logs", response_model=list[ActivityLogResponse])
async def list_activity_logs(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> list[ActivityLogResponse]:
    logs = (
        await session.scalars(
            select(ActivityLog)
            .where(ActivityLog.user_id == user.id)
            .order_by(ActivityLog.created_at.desc())
            .limit(limit)
        )
    ).all()
    return [activity_log_response(log) for log in logs]


@router.get("/account/export")
async def export_account_data(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    db_user = await session.get(User, user.id)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is unavailable.")
    profile = await ResumeService(session).get_active(user.id)
    preferences = await get_or_create_job_preferences(session, user.id)
    user_profile = await get_or_create_user_profile(session, user.id)
    subscription = await session.scalar(select(Subscription).where(Subscription.user_id == user.id))
    application_rows = (
        await session.execute(
            select(Application, Job)
            .join(Job, Application.job_id == Job.id)
            .where(Application.user_id == user.id)
            .order_by(Application.created_at.desc())
        )
    ).all()
    match_rows = (await session.scalars(select(JobMatch).where(JobMatch.user_id == user.id))).all()
    resume_version_rows = (await session.scalars(select(ResumeVersion).where(ResumeVersion.user_id == user.id).order_by(ResumeVersion.created_at.desc()))).all()
    resume_template_rows = (await session.scalars(select(ResumeTemplate).where(ResumeTemplate.user_id == user.id).order_by(ResumeTemplate.created_at.desc()))).all()
    cover_letter_rows = (await session.scalars(select(CoverLetter).where(CoverLetter.user_id == user.id).order_by(CoverLetter.created_at.desc()))).all()
    activity_rows = (
        await session.scalars(
            select(ActivityLog)
            .where(ActivityLog.user_id == user.id)
            .order_by(ActivityLog.created_at.desc())
            .limit(500)
        )
    ).all()
    payload = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "account": {
            "id": str(db_user.id),
            "email": db_user.email,
            "status": db_user.status,
            "role": db_user.role,
            "created_at": isoformat(db_user.created_at),
            "updated_at": isoformat(db_user.updated_at),
        },
        "application_profile": user_profile_response(user_profile).model_dump(),
        "resume_profile": resume_profile_export(profile) if profile else None,
        "job_preferences": {
            "role_keywords": preferences.role_keywords,
            "location": preferences.location,
            "remote_only": preferences.remote_only,
        },
        "subscription": {
            "plan": "owner" if user.role == "admin" else (subscription.plan if subscription else "free"),
            "status": subscription.status if subscription else "active",
            "provider": subscription.provider if subscription else None,
            "current_period_end": isoformat(subscription.current_period_end) if subscription else None,
        },
        "applications": [
            {
                **application_response(application, job).model_dump(),
                "job": job_export(job),
            }
            for application, job in application_rows
        ],
        "job_matches": [
            {
                "job_id": str(match.job_id),
                "match_score": match.match_score,
                "ats_score": match.ats_score,
                "ats_breakdown": match.ats_breakdown,
                "ats_recommendations": match.ats_recommendations,
                "approval_status": match.approval_status,
                "matching_skills": match.matching_skills,
                "missing_skills": match.missing_skills,
                "created_at": isoformat(match.created_at),
            }
            for match in match_rows
        ],
        "resume_versions": [
            {
                "id": str(version.id),
                "job_id": str(version.job_id),
                "master_resume_id": str(version.master_resume_id),
                "template_id": str(version.template_id) if version.template_id else None,
                "ats_score": version.ats_score,
                "resume_content": version.resume_content,
                "created_at": isoformat(version.created_at),
            }
            for version in resume_version_rows
        ],
        "resume_templates": [
            {
                "id": str(template.id),
                "name": template.name,
                "original_filename": template.original_filename,
                "placeholders": template.placeholders,
                "is_active": template.is_active,
                "created_at": isoformat(template.created_at),
            }
            for template in resume_template_rows
        ],
        "cover_letters": [
            {
                "id": str(letter.id),
                "job_id": str(letter.job_id),
                "content": letter.content,
                "created_at": isoformat(letter.created_at),
            }
            for letter in cover_letter_rows
        ],
        "activity_logs": [activity_log_response(log).model_dump() for log in activity_rows],
    }
    log_activity(session, user.id, "account_data_exported", {"record_sections": list(payload.keys())})
    await session.commit()
    return Response(
        json.dumps(payload, ensure_ascii=False, indent=2),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="apply-wise-account-export.json"'},
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
        await session.flush()
        session.add(ApplicationEvent(application_id=application.id, event_type="application_saved", to_status=ApplicationStatus.SAVED.value))
        log_activity(session, user.id, "application_saved", {"job_id": str(stored_job.id), "application_id": str(application.id)})
        await session.commit()
    return application_response(application, stored_job)


@router.post("/jobs/{job_id}/resume-versions", response_model=ResumeVersionDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_job_resume_version(
    job_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeVersionDetailResponse:
    job, stored_match = await get_owned_scored_job(session, job_id, user.id)
    profile, materials = await safe_tailored_materials(job, user.id, session, include_resume=True, include_cover_letter=False)
    resume_content = validate_resume_version_content(materials.resume_content)
    quality_warnings = quality_warning_messages(find_unsupported_claims(resume_content, None, profile))
    active_template = await get_active_resume_template(session, user.id)
    resume_version = ResumeVersion(
        user_id=user.id,
        job_id=job.id,
        master_resume_id=profile.id,
        template_id=active_template.id if active_template else None,
        ats_score=stored_match.ats_score,
        resume_content=resume_content,
        prompt_version=materials.prompt_version,
        model_provider=materials.model_provider,
        model_name=materials.model_name,
        generation_status=materials.generation_status,
        quality_warnings=quality_warnings,
    )
    session.add(resume_version)
    await session.flush()
    application = await session.scalar(select(Application).where(Application.user_id == user.id, Application.job_id == job.id))
    if application:
        previous_status = application.status
        application.status = ApplicationStatus.PREPARING
        application.resume_version_id = resume_version.id
        session.add(
            ApplicationEvent(
                application_id=application.id,
                event_type="resume_generated",
                from_status=previous_status.value,
                to_status=ApplicationStatus.PREPARING.value,
                metadata_={
                    "resume_version_id": str(resume_version.id),
                    "ats_score": resume_version.ats_score,
                    "prompt_version": materials.prompt_version,
                    "model_provider": materials.model_provider,
                    "model_name": materials.model_name,
                    "quality_warning_count": len(quality_warnings),
                },
            )
        )
    log_activity(
        session,
        user.id,
        "resume_generated",
        {
            "job_id": str(job.id),
            "resume_version_id": str(resume_version.id),
            "ats_score": resume_version.ats_score,
            "prompt_version": materials.prompt_version,
            "model_provider": materials.model_provider,
            "model_name": materials.model_name,
        },
    )
    await session.commit()
    return resume_version_detail_response(resume_version, job, stored_match, active_template)


@router.get("/resume-templates", response_model=list[ResumeTemplateResponse])
async def list_resume_templates(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ResumeTemplateResponse]:
    rows = (await session.scalars(select(ResumeTemplate).where(ResumeTemplate.user_id == user.id).order_by(ResumeTemplate.created_at.desc()))).all()
    has_active_custom = any(template.is_active for template in rows)
    return [default_template_response(not has_active_custom), *[resume_template_response(template) for template in rows]]


@router.get("/resume-templates/active/preview", response_model=ResumeTemplatePreviewResponse)
async def preview_active_resume_template(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeTemplatePreviewResponse:
    template = await get_active_resume_template(session, user.id)
    db_user = await session.scalar(select(User).where(User.id == user.id))
    user_profile = await session.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = await ResumeService(session).get_active(user.id)
    content = preview_resume_content(profile)
    preview = resume_export_service.preview_sections(content, user=db_user, user_profile=user_profile)
    placeholders = [str(placeholder) for placeholder in (template.placeholders if template else default_template_response(True).placeholders)]
    section_order = resume_template_section_order(placeholders)
    return ResumeTemplatePreviewResponse(
        template=resume_template_response(template) if template else default_template_response(True),
        section_order=section_order,
        missing_placeholders=[section for section in ["SUMMARY", "SKILLS", "EXPERIENCE", "PROJECTS", "EDUCATION", "CERTIFICATIONS"] if section not in section_order],
        preview=preview,
    )


@router.post("/resume-templates", response_model=ResumeTemplateResponse, status_code=status.HTTP_201_CREATED)
@router.post("/resume-templates/upload", response_model=ResumeTemplateResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume_template(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    file: Annotated[UploadFile, File(...)],
) -> ResumeTemplateResponse:
    content = await file.read()
    filename = file.filename or "resume-template.docx"
    if len(content) > MAX_RESUME_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Template is too large. Upload a DOCX file under 10 MB.")
    if file.content_type != "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or not filename.lower().endswith(".docx"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Upload a DOCX resume template.")
    try:
        placeholders = extract_placeholders_from_docx(content)
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Template DOCX could not be read. Upload a valid DOCX file.") from error
    if not placeholders:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Template must include at least one supported placeholder such as {{SUMMARY}}, {{SKILLS}}, or {{EXPERIENCE}}.")
    await session.execute(
        update(ResumeTemplate)
        .where(ResumeTemplate.user_id == user.id, ResumeTemplate.is_active.is_(True))
        .values(is_active=False)
    )
    template = ResumeTemplate(
        user_id=user.id,
        name=Path(filename).stem[:255],
        original_filename=Path(filename).name[:255],
        content_type=file.content_type,
        template_bytes=content,
        placeholders=placeholders,
        is_active=True,
    )
    session.add(template)
    log_activity(session, user.id, "resume_template_uploaded", {"template_name": template.name, "placeholders": placeholders})
    await session.commit()
    await session.refresh(template)
    return resume_template_response(template)


@router.patch("/resume-templates/{template_id}", response_model=ResumeTemplateResponse)
async def rename_resume_template(
    template_id: UUID,
    payload: ResumeTemplateUpdateRequest,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeTemplateResponse:
    template = await session.scalar(select(ResumeTemplate).where(ResumeTemplate.id == template_id, ResumeTemplate.user_id == user.id))
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume template not found.")
    template.name = payload.name.strip()
    log_activity(session, user.id, "resume_template_renamed", {"template_id": str(template.id), "template_name": template.name})
    await session.commit()
    await session.refresh(template)
    return resume_template_response(template)


@router.delete("/resume-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume_template(
    template_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    template = await session.scalar(select(ResumeTemplate).where(ResumeTemplate.id == template_id, ResumeTemplate.user_id == user.id))
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume template not found.")
    await session.execute(update(ResumeVersion).where(ResumeVersion.template_id == template.id, ResumeVersion.user_id == user.id).values(template_id=None))
    await session.delete(template)
    log_activity(session, user.id, "resume_template_deleted", {"template_id": str(template.id), "template_name": template.name})
    await session.commit()


@router.patch("/resume-templates/{template_id}/activate", response_model=ResumeTemplateResponse)
@router.post("/resume-templates/{template_id}/select", response_model=ResumeTemplateResponse)
async def select_resume_template(
    template_id: str,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeTemplateResponse:
    await session.execute(
        update(ResumeTemplate)
        .where(ResumeTemplate.user_id == user.id, ResumeTemplate.is_active.is_(True))
        .values(is_active=False)
    )
    if template_id == "default":
        log_activity(session, user.id, "resume_template_selected", {"template_id": "default", "template_name": "Built-in ATS template"})
        await session.commit()
        return default_template_response(True)
    try:
        parsed_id = UUID(template_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume template not found.") from error
    template = await session.scalar(select(ResumeTemplate).where(ResumeTemplate.id == parsed_id, ResumeTemplate.user_id == user.id))
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume template not found.")
    template.is_active = True
    log_activity(session, user.id, "resume_template_selected", {"template_id": str(template.id), "template_name": template.name})
    await session.commit()
    await session.refresh(template)
    return resume_template_response(template)


@router.post("/jobs/{job_id}/cover-letters", response_model=CoverLetterResponse, status_code=status.HTTP_201_CREATED)
async def create_job_cover_letter(
    job_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CoverLetterResponse:
    job, stored_match = await get_owned_scored_job(session, job_id, user.id)
    profile, materials = await safe_tailored_materials(job, user.id, session, include_resume=False, include_cover_letter=True)
    quality_warnings = quality_warning_messages(find_unsupported_claims(None, materials.cover_letter, profile))
    cover_letter = CoverLetter(
        user_id=user.id,
        job_id=job.id,
        content=materials.cover_letter,
        ats_score=stored_match.ats_score,
        prompt_version=materials.prompt_version,
        model_provider=materials.model_provider,
        model_name=materials.model_name,
        generation_status=materials.generation_status,
        quality_warnings=quality_warnings,
    )
    session.add(cover_letter)
    await session.flush()
    application = await session.scalar(select(Application).where(Application.user_id == user.id, Application.job_id == job.id))
    if application:
        previous_status = application.status
        application.status = ApplicationStatus.PREPARING
        application.cover_letter_id = cover_letter.id
        session.add(
            ApplicationEvent(
                application_id=application.id,
                event_type="cover_letter_generated",
                from_status=previous_status.value,
                to_status=ApplicationStatus.PREPARING.value,
                metadata_={
                    "cover_letter_id": str(cover_letter.id),
                    "prompt_version": materials.prompt_version,
                    "model_provider": materials.model_provider,
                    "model_name": materials.model_name,
                    "quality_warning_count": len(quality_warnings),
                },
            )
        )
    log_activity(
        session,
        user.id,
        "cover_letter_generated",
        {
            "job_id": str(job.id),
            "cover_letter_id": str(cover_letter.id),
            "ats_score": cover_letter.ats_score,
            "prompt_version": materials.prompt_version,
            "model_provider": materials.model_provider,
            "model_name": materials.model_name,
        },
    )
    await session.commit()
    return cover_letter_response(cover_letter)


@router.get("/resume-versions", response_model=list[ResumeVersionResponse])
async def list_resume_versions(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ResumeVersionResponse]:
    rows = await session.execute(
        select(ResumeVersion, Job, ResumeTemplate)
        .join(Job, ResumeVersion.job_id == Job.id)
        .outerjoin(ResumeTemplate, ResumeVersion.template_id == ResumeTemplate.id)
        .where(ResumeVersion.user_id == user.id)
        .order_by(ResumeVersion.created_at.desc())
    )
    return [resume_version_response(version, job, template) for version, job, template in rows.all()]


@router.get("/resume-versions/{version_id}", response_model=ResumeVersionDetailResponse)
async def get_resume_version(
    version_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeVersionDetailResponse:
    version, job = await get_owned_resume_version_row(session, version_id, user.id)
    match = await session.scalar(select(JobMatch).where(JobMatch.user_id == user.id, JobMatch.job_id == job.id))
    template = await get_resume_version_template(session, version)
    return resume_version_detail_response(version, job, match, template)


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
    match = await session.scalar(select(JobMatch).where(JobMatch.user_id == user.id, JobMatch.job_id == job.id))
    template = await get_resume_version_template(session, version)
    return resume_version_detail_response(version, job, match, template)


@router.get("/resume-versions/{version_id}/download")
async def download_resume_version(
    version_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    format: Annotated[str, Query(pattern="^(docx|pdf)$")] = "docx",
    acknowledge_quality_warnings: bool = False,
) -> Response:
    version, job = await get_owned_resume_version_row(session, version_id, user.id)
    quality_warnings = await quality_warnings_for_resume_version(session, version, user.id)
    if quality_warnings and not acknowledge_quality_warnings:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Review and acknowledge unsupported-claim warnings before downloading this resume.",
                "quality_warnings": quality_warnings,
            },
        )
    db_user = await session.scalar(select(User).where(User.id == user.id))
    user_profile = await session.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    template = await get_export_resume_template(session, user.id, version)
    body, media_type, attempts = build_resume_export(version, job, format, db_user, user_profile, template)
    application = await session.scalar(select(Application).where(Application.user_id == user.id, Application.resume_version_id == version.id))
    if application:
        session.add(
            ApplicationEvent(
                application_id=application.id,
                event_type="resume_export_downloaded",
                metadata_={"format": format, "retry_attempts": attempts, "manual_final_submission_required": True},
            )
        )
        await session.commit()
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
        if payload.status == ApplicationStatus.APPLIED and not payload.manual_submission_confirmed:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Confirm that you manually submitted on the employer site before marking this application applied.")
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
        if payload.status == ApplicationStatus.APPLIED:
            session.add(
                ApplicationEvent(
                    application_id=application.id,
                    event_type="application_marked_applied",
                    from_status=previous_status.value,
                    to_status=payload.status.value,
                    metadata_={"manual_final_submission_required": True},
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
    capability = capability_for_url(job.url)
    review_confirmed = bool(
        await session.scalar(
            select(func.count())
            .select_from(ApplicationEvent)
            .where(ApplicationEvent.application_id == application.id, ApplicationEvent.event_type == "review_before_apply_confirmed")
        )
    )
    ats_approved = bool(match and match.approval_status == "approved")
    resume_prepared = application.resume_version_id is not None
    cover_letter_prepared = application.cover_letter_id is not None
    blocking_reasons: list[str] = []
    next_steps: list[str] = []
    if not ats_approved:
        blocking_reasons.append("Approve this role from Jobs before assisted application.")
        next_steps.append("Review the job match and approve the role if you want to proceed.")
    if not resume_prepared or not cover_letter_prepared:
        blocking_reasons.append("Generate a tailored resume and cover letter before filling employer forms.")
        next_steps.append("Use Prepare materials to generate truthful application drafts.")
    if not review_confirmed:
        blocking_reasons.append("Confirm the Review Application package before loading extension autofill.")
        next_steps.append("Open Review Application and confirm that the job, materials, fields, and warnings were reviewed.")
    if not capability.autofill_supported:
        blocking_reasons.append("Assisted autofill is not supported for this employer site yet.")
        next_steps.append("Use Apply Wise materials, then fill the employer form manually.")
    if not blocking_reasons:
        next_steps.append("Open the employer page, load the extension autofill plan, preview fields, approve filling, then submit manually.")
    return AssistedApplicationChecklistResponse(
        application_id=str(application.id),
        duplicate_prevention=True,
        ats_approved=ats_approved,
        resume_prepared=resume_prepared,
        resume_version_id=str(application.resume_version_id) if application.resume_version_id else None,
        cover_letter_prepared=cover_letter_prepared,
        cover_letter_id=str(application.cover_letter_id) if application.cover_letter_id else None,
        review_confirmed=review_confirmed,
        autofill_supported=capability.autofill_supported,
        resume_upload_supported=capability.resume_upload_supported,
        ready_for_assisted_apply=not blocking_reasons,
        blocking_reasons=blocking_reasons,
        next_steps=next_steps,
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


@router.get("/applications/{application_id}/automation-runs", response_model=list[AutomationRunResponse])
async def list_application_automation_runs(
    application_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[AutomationRunResponse]:
    application = await session.scalar(select(Application).where(Application.id == application_id, Application.user_id == user.id))
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    runs = (
        await session.scalars(
            select(AutomationRun)
            .where(AutomationRun.application_id == application.id, AutomationRun.user_id == user.id)
            .order_by(AutomationRun.created_at.desc())
            .limit(10)
        )
    ).all()
    return [automation_run_response(run) for run in runs]


@router.post("/applications/{application_id}/automation-runs", response_model=AutomationRunResponse, status_code=status.HTTP_201_CREATED)
async def create_application_automation_run(
    application_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AutomationRunResponse:
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
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Upload a master resume before starting an assisted run.")
    capability = capability_for_url(job.url)
    quality_warnings = [
        warning.message
        for warning in find_unsupported_claims(
            resume_version.resume_content if resume_version else None,
            cover_letter.content if cover_letter else None,
            profile,
        )
    ]
    warnings = automation_run_warnings(application, capability, quality_warnings)
    blocked = bool(warnings)
    run = AutomationRun(
        application_id=application.id,
        user_id=user.id,
        site_key=capability.site_key,
        status="blocked" if blocked else "ready_for_user_review",
        current_step="resolve_readiness_warnings" if blocked else "open_employer_page",
        warnings=warnings,
        result={
            "target_url": job.url,
            "capability": capability.site_key,
            "quality_warning_count": len(quality_warnings),
            "next_action": "Resolve warnings before assisted autofill." if blocked else "Open the employer page and use the reviewed extension autofill flow.",
        },
        manual_final_submission_required=True,
    )
    session.add_all(
        [
            run,
            ApplicationEvent(
                application_id=application.id,
                event_type="automation_run_created",
                metadata_={
                    "run_status": run.status,
                    "site_key": capability.site_key,
                    "warning_count": len(warnings),
                    "manual_final_submission_required": True,
                },
            ),
        ]
    )
    await session.commit()
    return automation_run_response(run)


@router.get("/applications/{application_id}/review-before-apply", response_model=ReviewBeforeApplyResponse)
async def review_before_apply(
    application_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ReviewBeforeApplyResponse:
    row = await session.execute(
        select(Application, Job, ResumeVersion, CoverLetter, JobMatch)
        .join(Job, Application.job_id == Job.id)
        .outerjoin(ResumeVersion, Application.resume_version_id == ResumeVersion.id)
        .outerjoin(CoverLetter, Application.cover_letter_id == CoverLetter.id)
        .outerjoin(JobMatch, (JobMatch.job_id == Job.id) & (JobMatch.user_id == user.id))
        .where(Application.id == application_id, Application.user_id == user.id)
    )
    result = row.one_or_none()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    application, job, resume_version, cover_letter, job_match = result
    profile = await ResumeService(session).get_active(user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Upload a master resume before reviewing an application.")
    selected_template = await get_export_resume_template(session, user.id, resume_version) if resume_version else await get_active_resume_template(session, user.id)
    db_user = await session.get(User, user.id)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is unavailable.")
    user_profile = await get_or_create_user_profile(session, user.id)
    fields = build_autofill_plan(user=db_user, profile=profile, job=job, resume_version=resume_version, cover_letter=cover_letter, user_profile=user_profile)
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
    review_confirmed = await session.scalar(
        select(func.count())
        .select_from(ApplicationEvent)
        .where(ApplicationEvent.application_id == application.id, ApplicationEvent.event_type == "review_before_apply_confirmed")
    )
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
        job_id=str(job.id),
        job_title=job.title,
        company=job.company,
        location=job.location,
        source=job.source,
        target_url=job.url,
        match_score=job_match.match_score if job_match else None,
        ats_score=job_match.ats_score if job_match else resume_version.ats_score if resume_version else None,
        matching_skills=[str(skill) for skill in ((job_match.matching_skills if job_match else []) or [])],
        missing_skills=[str(skill) for skill in ((job_match.missing_skills if job_match else []) or [])],
        template_id=str(selected_template.id) if selected_template else None,
        template_name=selected_template.name if selected_template else "Built-in ATS template",
        resume_version_id=str(resume_version.id) if resume_version else None,
        cover_letter_id=str(cover_letter.id) if cover_letter else None,
        resume_summary=resume_content_summary(resume_version.resume_content) if resume_version else None,
        cover_letter_preview=cover_letter.content[:700] if cover_letter else None,
        resume_prepared=resume_version is not None,
        cover_letter_prepared=cover_letter is not None,
        autofill_fields=[AutofillFieldResponse(**field.__dict__) for field in fields],
        missing_fields=dedupe_preserve_order(missing_fields),
        quality_warnings=quality_warnings,
        warnings=warnings,
        review_confirmed=bool(review_confirmed),
        application_status=application.status.value,
    )


@router.post("/applications/{application_id}/review-before-apply/confirm", response_model=ReviewBeforeApplyResponse)
async def confirm_review_before_apply(
    application_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ReviewBeforeApplyResponse:
    application = await session.scalar(select(Application).where(Application.id == application_id, Application.user_id == user.id))
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    session.add(
        ApplicationEvent(
            application_id=application.id,
            event_type="review_before_apply_confirmed",
            metadata_={"manual_final_submission_required": True, "autofill_requires_user_approval": True},
        )
    )
    await session.commit()
    response = await review_before_apply(application_id, user, session)
    response.review_confirmed = True
    return response


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
    return await prepare_application_materials(session, application_id, user.id)


@router.post("/applications/{application_id}/prepare-runs", response_model=BackgroundJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_prepare_run(
    application_id: UUID,
    background_tasks: BackgroundTasks,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BackgroundJobResponse:
    application = await session.scalar(select(Application).where(Application.id == application_id, Application.user_id == user.id))
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    job = BackgroundJob(
        user_id=user.id,
        application_id=application.id,
        job_type="prepare_application_materials",
        status="queued",
        payload={"application_id": str(application.id), "manual_final_submission_required": True},
        result={},
    )
    session.add(job)
    await session.flush()
    session.add(
        ApplicationEvent(
            application_id=application.id,
            event_type="prepare_job_queued",
            metadata_={"background_job_id": str(job.id), "manual_final_submission_required": True},
        )
    )
    await session.commit()
    background_tasks.add_task(run_prepare_job, job.id, application.id, user.id)
    return background_job_response(job)


@router.get("/applications/{application_id}/prepare-runs", response_model=list[BackgroundJobResponse])
async def list_prepare_runs(
    application_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[BackgroundJobResponse]:
    application = await session.scalar(select(Application).where(Application.id == application_id, Application.user_id == user.id))
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    jobs = (
        await session.scalars(
            select(BackgroundJob)
            .where(BackgroundJob.application_id == application.id, BackgroundJob.user_id == user.id, BackgroundJob.job_type == "prepare_application_materials")
            .order_by(BackgroundJob.created_at.desc())
            .limit(10)
        )
    ).all()
    return [background_job_response(job) for job in jobs]


@router.get("/background-jobs/{job_id}", response_model=BackgroundJobResponse)
async def get_background_job(
    job_id: UUID,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BackgroundJobResponse:
    job = await session.scalar(select(BackgroundJob).where(BackgroundJob.id == job_id, BackgroundJob.user_id == user.id))
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Background job not found.")
    return background_job_response(job)


@router.post("/background-jobs/{job_id}/retry", response_model=BackgroundJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def retry_background_job(
    job_id: UUID,
    background_tasks: BackgroundTasks,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BackgroundJobResponse:
    job = await session.scalar(select(BackgroundJob).where(BackgroundJob.id == job_id, BackgroundJob.user_id == user.id))
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Background job not found.")
    if job.job_type != "prepare_application_materials" or not job.application_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="This background job type cannot be retried from the app.")
    if job.status not in {"failed", "queued"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only failed or queued preparation jobs can be retried.")
    application = await session.scalar(select(Application).where(Application.id == job.application_id, Application.user_id == user.id))
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    job.status = "queued"
    job.error_message = None
    job.result = {}
    job.completed_at = None
    session.add(
        ApplicationEvent(
            application_id=application.id,
            event_type="prepare_job_retried",
            metadata_={"background_job_id": str(job.id), "attempts": job.attempts, "manual_final_submission_required": True},
        )
    )
    await session.commit()
    background_tasks.add_task(run_prepare_job, job.id, application.id, user.id)
    return background_job_response(job)


async def get_owned_scored_job(session: AsyncSession, job_id: UUID, user_id: UUID) -> tuple[Job, JobMatch]:
    row = await session.execute(
        select(Job, JobMatch)
        .join(JobMatch, JobMatch.job_id == Job.id)
        .where(Job.id == job_id, JobMatch.user_id == user_id)
    )
    result = row.one_or_none()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scored job not found for this user.")
    return result


async def safe_tailored_materials(
    job: Job,
    user_id: UUID,
    session: AsyncSession,
    *,
    include_resume: bool,
    include_cover_letter: bool,
    missing_resume_message: str = "Upload a master resume before generating application materials.",
) -> tuple[ResumeProfile, TailoredMaterials]:
    profile = await ResumeService(session).get_active(user_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=missing_resume_message)
    if include_resume and not profile.experiences:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Resume profile data is too weak to generate a truthful tailored resume. Add or correct experience in your master resume first.",
        )
    materials = tailoring_service.prepare(job, profile)
    warnings = find_unsupported_claims(
        materials.resume_content if include_resume else None,
        materials.cover_letter if include_cover_letter else None,
        profile,
    )
    if warnings and materials.provenance != "deterministic_evidence_grounded":
        materials = build_fallback_materials(job, profile)
        warnings = find_unsupported_claims(
            materials.resume_content if include_resume else None,
            materials.cover_letter if include_cover_letter else None,
            profile,
        )
    if warnings:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Generated material contained unsupported claims and was not stored.",
                "quality_warnings": quality_warning_messages(warnings),
            },
        )
    return profile, materials


async def prepare_application_materials(session: AsyncSession, application_id: UUID, user_id: UUID) -> ApplicationMaterialsResponse:
    row = await session.execute(
        select(Application, Job)
        .join(Job, Application.job_id == Job.id)
        .where(Application.id == application_id, Application.user_id == user_id)
    )
    result = row.one_or_none()
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found.")
    application, job = result
    profile, materials = await safe_tailored_materials(
        job,
        user_id,
        session,
        include_resume=True,
        include_cover_letter=True,
        missing_resume_message="Upload a master resume before preparing an application.",
    )
    stored_match = await session.scalar(select(JobMatch).where(JobMatch.user_id == user_id, JobMatch.job_id == job.id))
    resume_content = materials.resume_content
    quality_warnings = quality_warning_messages(find_unsupported_claims(resume_content, materials.cover_letter, profile))
    active_template = await get_active_resume_template(session, user_id)
    resume_version = ResumeVersion(
        user_id=user_id,
        job_id=job.id,
        master_resume_id=profile.id,
        template_id=active_template.id if active_template else None,
        ats_score=stored_match.ats_score if stored_match else 0,
        resume_content=resume_content,
        prompt_version=materials.prompt_version,
        model_provider=materials.model_provider,
        model_name=materials.model_name,
        generation_status=materials.generation_status,
        quality_warnings=quality_warnings,
    )
    cover_letter = CoverLetter(
        user_id=user_id,
        job_id=job.id,
        content=materials.cover_letter,
        ats_score=stored_match.ats_score if stored_match else 0,
        prompt_version=materials.prompt_version,
        model_provider=materials.model_provider,
        model_name=materials.model_name,
        generation_status=materials.generation_status,
        quality_warnings=quality_warnings,
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
    session.add_all(
        [
            ApplicationEvent(
                application_id=application.id,
                event_type="resume_generated",
                metadata_={
                    "resume_version_id": str(resume_version.id),
                    "ats_score": resume_version.ats_score,
                    "prompt_version": materials.prompt_version,
                    "model_provider": materials.model_provider,
                    "model_name": materials.model_name,
                    "quality_warning_count": len(quality_warnings),
                },
            ),
            ApplicationEvent(
                application_id=application.id,
                event_type="cover_letter_generated",
                metadata_={
                    "cover_letter_id": str(cover_letter.id),
                    "prompt_version": materials.prompt_version,
                    "model_provider": materials.model_provider,
                    "model_name": materials.model_name,
                    "quality_warning_count": len(quality_warnings),
                },
            ),
        ]
    )
    log_activity(
        session,
        user_id,
        "application_materials_prepared",
        {
            "application_id": str(application.id),
            "job_id": str(job.id),
            "resume_version_id": str(resume_version.id),
            "cover_letter_id": str(cover_letter.id),
            "template_id": str(resume_version.template_id) if resume_version.template_id else None,
        },
    )
    await session.commit()
    return ApplicationMaterialsResponse(
        application=application_response(application, job),
        application_status=application.status.value,
        resume_version_id=str(resume_version.id),
        template_id=str(resume_version.template_id) if resume_version.template_id else None,
        template_name=active_template.name if active_template else "Built-in ATS template",
        ats_score=resume_version.ats_score,
        resume_content=resume_content,
        cover_letter_id=str(cover_letter.id),
        cover_letter=cover_letter.content,
        matching_skills=[str(skill) for skill in ((stored_match.matching_skills if stored_match else []) or [])],
        missing_skills=[str(skill) for skill in ((stored_match.missing_skills if stored_match else []) or [])],
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


async def get_or_create_user_profile(session: AsyncSession, user_id: UUID) -> UserProfile:
    profile = await session.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    if profile:
        return profile
    profile = UserProfile(user_id=user_id)
    session.add(profile)
    await session.flush()
    return profile


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


def user_profile_response(profile: UserProfile) -> UserProfileResponse:
    return UserProfileResponse(
        full_name=profile.full_name,
        phone=profile.phone,
        location=profile.location,
        linkedin_url=profile.linkedin_url,
        github_url=profile.github_url,
        portfolio_url=profile.portfolio_url,
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


def automation_run_warnings(application: Application, capability, quality_warnings: list[str]) -> list[str]:
    warnings: list[str] = []
    if not capability.dry_run_supported:
        warnings.append("This site does not currently support assisted dry-run automation.")
    if not capability.autofill_supported:
        warnings.append("This site requires manual form entry because assisted autofill is not supported yet.")
    if not application.resume_version_id:
        warnings.append("Prepare a tailored resume before starting an assisted run.")
    if not application.cover_letter_id:
        warnings.append("Prepare a cover letter before starting an assisted run.")
    if quality_warnings:
        warnings.append("Review unsupported generated claims before using assisted application support.")
    return warnings


def automation_run_response(run: AutomationRun) -> AutomationRunResponse:
    created_at = run.created_at
    updated_at = run.updated_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)
    return AutomationRunResponse(
        id=str(run.id),
        application_id=str(run.application_id),
        site_key=run.site_key,
        status=run.status,
        current_step=run.current_step,
        warnings=[str(warning) for warning in (run.warnings or [])],
        result=run.result or {},
        manual_final_submission_required=run.manual_final_submission_required,
        created_at=created_at.isoformat(),
        updated_at=updated_at.isoformat(),
    )


def background_job_response(job: BackgroundJob) -> BackgroundJobResponse:
    created_at = job.created_at
    updated_at = job.updated_at
    completed_at = job.completed_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)
    if completed_at and completed_at.tzinfo is None:
        completed_at = completed_at.replace(tzinfo=timezone.utc)
    return BackgroundJobResponse(
        id=str(job.id),
        job_type=job.job_type,
        status=job.status,
        attempts=job.attempts,
        payload=job.payload or {},
        result=job.result or {},
        error_message=job.error_message,
        created_at=created_at.isoformat(),
        updated_at=updated_at.isoformat(),
        completed_at=completed_at.isoformat() if completed_at else None,
    )


async def run_prepare_job(job_id: UUID, application_id: UUID, user_id: UUID) -> None:
    async with session_factory() as session:
        job = await session.get(BackgroundJob, job_id)
        if not job:
            return
        job.status = "running"
        job.attempts += 1
        job.error_message = None
        await session.commit()
        try:
            materials = await prepare_application_materials(session, application_id, user_id)
        except Exception as error:
            await session.rollback()
            job = await session.get(BackgroundJob, job_id)
            if job:
                job.status = "failed"
                job.error_message = str(error)[:500] or error.__class__.__name__
                job.completed_at = datetime.now(timezone.utc)
                session.add(ApplicationEvent(application_id=application_id, event_type="prepare_job_failed", metadata_={"background_job_id": str(job_id)}))
                await session.commit()
            return
        job = await session.get(BackgroundJob, job_id)
        if job:
            job.status = "succeeded"
            job.result = {
                "resume_version_id": materials.resume_version_id,
                "cover_letter_id": materials.cover_letter_id,
                "generation_status": materials.generation_status,
                "retry_attempts": materials.retry_attempts,
            }
            job.completed_at = datetime.now(timezone.utc)
            session.add(
                ApplicationEvent(
                    application_id=application_id,
                    event_type="prepare_job_succeeded",
                    metadata_={"background_job_id": str(job_id), "resume_version_id": materials.resume_version_id, "cover_letter_id": materials.cover_letter_id},
                )
            )
            await session.commit()


def build_resume_export(version: ResumeVersion, job: Job, format: str, user: User | None, user_profile: UserProfile | None, template: ResumeTemplate | None) -> tuple[bytes, str, int]:
    def operation() -> tuple[bytes, str]:
        if format == "pdf":
            return resume_export_service.build_pdf(version, job, user=user, user_profile=user_profile, template=template), "application/pdf"
        return (
            resume_export_service.build_docx(version, job, user=user, user_profile=user_profile, template=template),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

    result = run_with_retries(operation, (Exception,), export_retry_policy)
    if result.value is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not build resume export. Please try again.")
    body, media_type = result.value
    return body, media_type, result.attempts


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


def quality_warning_messages(warnings) -> list[str]:
    return [str(warning.message) for warning in warnings]


class JobHtmlExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.h1_parts: list[str] = []
        self.visible_parts: list[str] = []
        self.meta: dict[str, str] = {}
        self._tag_stack: list[str] = []
        self._capture_title = False
        self._capture_h1 = False
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attributes = {key.lower(): value or "" for key, value in attrs}
        if tag in {"script", "style", "noscript", "svg", "nav", "footer"}:
            self._skip_depth += 1
        if tag == "title":
            self._capture_title = True
        if tag == "h1":
            self._capture_h1 = True
        if tag == "meta":
            key = attributes.get("property") or attributes.get("name")
            content = attributes.get("content", "").strip()
            if key and content:
                self.meta[key.lower()] = clean_visible_text(content)
        self._tag_stack.append(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"script", "style", "noscript", "svg", "nav", "footer"} and self._skip_depth:
            self._skip_depth -= 1
        if tag == "title":
            self._capture_title = False
        if tag == "h1":
            self._capture_h1 = False
        if self._tag_stack:
            self._tag_stack.pop()

    def handle_data(self, data: str) -> None:
        text = clean_visible_text(data)
        if not text:
            return
        if self._capture_title:
            self.title_parts.append(text)
        if self._capture_h1:
            self.h1_parts.append(text)
        if not self._skip_depth:
            self.visible_parts.append(text)


def validate_public_job_url(raw_url: str) -> str:
    parsed = urlparse(raw_url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a full public http or https job URL.")
    host = (parsed.hostname or "").lower()
    if host in {"localhost", "0.0.0.0"} or host.endswith(".local"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Only public job URLs can be imported.")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address and (address.is_private or address.is_loopback or address.is_link_local or address.is_multicast or address.is_reserved):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Only public job URLs can be imported.")
    return raw_url.strip()


def extract_job_from_html(url: str, html: str) -> ManualJobRequest:
    extractor = JobHtmlExtractor()
    extractor.feed(html[:1_000_000])
    visible_text = clean_visible_text(" ".join(extractor.visible_parts))
    lines = visible_lines(extractor.visible_parts)
    title_candidates = [
        clean_job_title(" ".join(extractor.h1_parts)),
        clean_job_title(extractor.meta.get("og:title", "")),
        clean_job_title(extractor.meta.get("twitter:title", "")),
        clean_job_title(" ".join(extractor.title_parts)),
    ]
    title = next((candidate for candidate in title_candidates if candidate and not looks_like_generic_site(candidate)), "")
    company = extract_company(lines, extractor, title)
    location = extract_location(lines)
    description = extract_job_description(lines, visible_text)
    missing = []
    if not title:
        missing.append("title")
    if not company:
        missing.append("company")
    if len(description) < 120:
        missing.append("job description")
    if missing:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Could not extract {', '.join(missing)} from this URL. Paste the job details manually or use the extension.")
    return ManualJobRequest(
        title=title[:255],
        company=company[:255],
        location=(location or "Not specified")[:255],
        url=url,
        description=description[:50000],
    )


def clean_visible_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def visible_lines(parts: list[str]) -> list[str]:
    lines: list[str] = []
    for part in parts:
        cleaned = clean_visible_text(part)
        if cleaned and cleaned not in lines:
            lines.append(cleaned)
    return lines


def clean_job_title(value: str) -> str:
    cleaned = clean_visible_text(value)
    cleaned = re.sub(r"\s+[-|]\s+(LinkedIn|Indeed|Naukri|Careers|Jobs).*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^Apply for\s+", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip(" -|")


def looks_like_generic_site(value: str) -> bool:
    return bool(re.fullmatch(r"(jobs?|careers?|job search|linkedin|indeed|naukri|workday)", value.strip().lower()))


def extract_company(lines: list[str], extractor: JobHtmlExtractor, title: str) -> str:
    site_name = extractor.meta.get("og:site_name", "")
    if site_name and not looks_like_generic_site(site_name):
        return site_name
    title_line = clean_visible_text(extractor.meta.get("og:title", "") or " ".join(extractor.title_parts))
    for separator in (" at ", " - ", " | "):
        if separator in title_line:
            parts = [part.strip() for part in title_line.split(separator) if part.strip()]
            if len(parts) >= 2:
                candidate = parts[1] if parts[0] == title else parts[-1]
                if not looks_like_generic_site(candidate):
                    return candidate
    for index, line in enumerate(lines):
        if re.fullmatch(r"company", line, flags=re.IGNORECASE) and index + 1 < len(lines):
            return lines[index + 1]
        match = re.search(r"\bcompany\s*[:\-]\s*(.+)$", line, flags=re.IGNORECASE)
        if match:
            return clean_visible_text(match.group(1))
    return ""


def extract_location(lines: list[str]) -> str:
    for index, line in enumerate(lines):
        if re.fullmatch(r"location", line, flags=re.IGNORECASE) and index + 1 < len(lines):
            return lines[index + 1]
        match = re.search(r"\blocation\s*[:\-]\s*(.+)$", line, flags=re.IGNORECASE)
        if match:
            return clean_visible_text(match.group(1))
    for line in lines:
        if re.search(r"\b(remote|hybrid|on-site|india|united states|united kingdom|canada|australia|singapore|bengaluru|bangalore|mumbai|pune|noida|gurgaon|delhi|hyderabad|chennai)\b", line, flags=re.IGNORECASE):
            if not re.search(r"apply|save|posted|applicants|followers", line, flags=re.IGNORECASE):
                return line
    return ""


def extract_job_description(lines: list[str], visible_text: str) -> str:
    start_patterns = re.compile(r"^(about the job|job description|role overview|about this role|responsibilities|what you'?ll do)$", re.IGNORECASE)
    stop_patterns = re.compile(r"^(benefits|similar jobs|recommended jobs|people also viewed|share|apply now|language|footer|company overview)$", re.IGNORECASE)
    start_index = next((index for index, line in enumerate(lines) if start_patterns.search(line)), None)
    selected = lines[start_index + 1 :] if start_index is not None else lines
    description_lines: list[str] = []
    for line in selected:
        if stop_patterns.search(line):
            break
        if re.search(r"^(sign in|create alert|save job|apply|posted|applicants)$", line, re.IGNORECASE):
            continue
        description_lines.append(line)
    description = clean_visible_text(" ".join(description_lines))
    if len(description) < 120:
        description = clean_visible_text(visible_text)
    return description


def extension_error_response(status_code: int, error_code: str, message: str, details: dict | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "ok": False,
            "error_code": error_code,
            "message": message,
            "details": details or {},
        },
    )


def validate_extension_capture_payload(payload: dict) -> ManualJobRequest | JSONResponse:
    cleaned = {
        "title": clean_visible_text(str(payload.get("title", ""))),
        "company": clean_visible_text(str(payload.get("company", ""))),
        "location": clean_visible_text(str(payload.get("location", ""))) or "Not specified",
        "url": clean_visible_text(str(payload.get("url", ""))),
        "description": clean_visible_text(str(payload.get("description", ""))),
    }
    missing_fields = [field for field in ("title", "company", "url") if not cleaned[field]]
    if missing_fields:
        error_code = f"missing_{missing_fields[0]}"
        return extension_error_response(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_code,
            f"Missing required field: {', '.join(missing_fields)}.",
            {"missing_fields": missing_fields, "received_lengths": {key: len(value) for key, value in cleaned.items()}},
        )
    if not re.match(r"^https?://", cleaned["url"], flags=re.IGNORECASE):
        return extension_error_response(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "invalid_url",
            "Job URL must start with http:// or https://.",
            {"url": cleaned["url"]},
        )
    if len(cleaned["description"]) < 40:
        return extension_error_response(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "short_description",
            "Job description must be at least 40 characters.",
            {"description_length": len(cleaned["description"]), "minimum_length": 40},
        )
    try:
        return ManualJobRequest(**cleaned)
    except ValueError as error:
        return extension_error_response(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "invalid_capture_payload",
            "Captured job fields are invalid. Review and fix the fields in the extension popup.",
            {"error": str(error), "received_lengths": {key: len(value) for key, value in cleaned.items()}},
        )


async def quality_warnings_for_resume_version(session: AsyncSession, version: ResumeVersion, user_id: UUID) -> list[str]:
    profile = await ResumeService(session).get_active(user_id)
    if not profile:
        return []
    return [warning.message for warning in find_unsupported_claims(version.resume_content, None, profile)]


async def score_and_store_manual_job(session: AsyncSession, user_id: UUID, payload: ManualJobRequest, create_application: bool = False, source: str = "manual") -> JobResponse:
    profile = await ResumeService(session).get_active(user_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Upload a master resume before capturing a job.")
    external_id = sha256(payload.url.strip().encode()).hexdigest()
    job = ProviderJob(
        id=uuid5(NAMESPACE_URL, f"jobcopilot:{source}:{external_id}"),
        external_id=external_id,
        source=source,
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
    log_activity(
        session,
        user_id,
        "job_captured" if not create_application else "extension_job_captured",
        {
            "job_id": str(stored_job.id),
            "title": stored_job.title,
            "company": stored_job.company,
            "source": source,
            "match_score": match.match_score,
            "ats_score": ats.score,
            "created_application": bool(create_application),
        },
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
    review_confirmed = await session.scalar(
        select(func.count())
        .select_from(ApplicationEvent)
        .where(ApplicationEvent.application_id == application.id, ApplicationEvent.event_type == "review_before_apply_confirmed")
    )
    if not review_confirmed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Open Apply Wise, review this application, and confirm manual review before assisted autofill.")
    profile = await ResumeService(session).get_active(user_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Upload a master resume before assisted autofill.")
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is unavailable.")
    user_profile = await get_or_create_user_profile(session, user_id)
    fields = build_autofill_plan(user=user, profile=profile, job=job, resume_version=resume_version, cover_letter=cover_letter, user_profile=user_profile)
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
    db_user = await session.scalar(select(User).where(User.id == user_id))
    user_profile = await session.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    template = await get_export_resume_template(session, user_id, version)
    body, media_type, attempts = build_resume_export(version, job, format, db_user, user_profile, template)
    session.add(
        ApplicationEvent(
            application_id=application.id,
            event_type="resume_downloaded_for_upload",
            metadata_={"format": format, "retry_attempts": attempts, "manual_final_submission_required": True},
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


async def stored_scored_job_responses(
    session: AsyncSession,
    user_id: UUID,
    exclude_job_ids: set[UUID],
    query: str,
    location: str,
) -> list[JobResponse]:
    conditions = [JobMatch.user_id == user_id]
    if exclude_job_ids:
        conditions.append(JobMatch.job_id.notin_(list(exclude_job_ids)))
    if query.strip():
        pattern = f"%{query.strip()}%"
        conditions.append(or_(Job.title.ilike(pattern), Job.company.ilike(pattern), Job.description.ilike(pattern)))
    if location.strip():
        conditions.append(Job.location.ilike(f"%{location.strip()}%"))
    rows = (
        await session.execute(
            select(JobMatch, Job)
            .join(Job, JobMatch.job_id == Job.id)
            .where(*conditions)
            .order_by(JobMatch.created_at.desc())
            .limit(50)
        )
    ).all()
    job_ids = [job.id for _match, job in rows]
    applications = await saved_applications_by_job(session, user_id, job_ids)
    return [stored_job_response(match, job, applications.get(job.id)) for match, job in rows]


def stored_job_response(match: JobMatch, job: Job, application: Application | None = None) -> JobResponse:
    experience_match = 90 if "senior" in job.title.lower() else 100
    ats = AtsResult(
        score=round(float(match.ats_score or 0)),
        breakdown={str(key): round(float(value)) for key, value in (match.ats_breakdown or {}).items()},
        recommendations=tuple(str(item) for item in (match.ats_recommendations or [])),
    )
    summary_match = SimpleNamespace(
        matching_skills=list(match.matching_skills or []),
        missing_skills=list(match.missing_skills or []),
        experience_match=experience_match,
    )
    reasons = recommendation_reasons(summary_match, ats)
    return JobResponse(
        id=str(job.id),
        title=job.title,
        company=job.company,
        location=job.location,
        work_mode="Not specified",
        salary=job.salary,
        description=job.description,
        source=job.source,
        url=job.url,
        posted_at=None,
        match_score=round(float(match.match_score or 0)),
        matching_skills=list(match.matching_skills or []),
        missing_skills=list(match.missing_skills or []),
        experience_match=experience_match,
        ats_score=ats.score,
        ats_breakdown=ats.breakdown,
        ats_recommendations=list(ats.recommendations),
        recommendation_summary=reasons[0],
        recommendation_reasons=reasons,
        high_fit=ats.score >= settings.ats_high_fit_threshold,
        approval_status=match.approval_status,
        saved=application is not None,
        application_id=str(application.id) if application else None,
    )


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


async def get_active_resume_template(session: AsyncSession, user_id: UUID) -> ResumeTemplate | None:
    return await session.scalar(
        select(ResumeTemplate)
        .where(ResumeTemplate.user_id == user_id, ResumeTemplate.is_active.is_(True))
        .order_by(ResumeTemplate.created_at.desc())
    )


async def get_resume_version_template(session: AsyncSession, version: ResumeVersion) -> ResumeTemplate | None:
    if not version.template_id:
        return None
    return await session.scalar(select(ResumeTemplate).where(ResumeTemplate.id == version.template_id, ResumeTemplate.user_id == version.user_id))


async def get_export_resume_template(session: AsyncSession, user_id: UUID, version: ResumeVersion) -> ResumeTemplate | None:
    return await get_resume_version_template(session, version) or await get_active_resume_template(session, user_id)


def default_template_response(is_active: bool) -> ResumeTemplateResponse:
    return ResumeTemplateResponse(
        id="default",
        name="Built-in ATS template",
        source="built_in",
        original_filename=None,
        placeholders=["NAME", "CONTACT", "SUMMARY", "SKILLS", "EXPERIENCE", "PROJECTS", "EDUCATION", "CERTIFICATIONS"],
        is_active=is_active,
        created_at=None,
    )


def resume_template_response(template: ResumeTemplate) -> ResumeTemplateResponse:
    created_at = template.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return ResumeTemplateResponse(
        id=str(template.id),
        name=template.name,
        source="custom",
        original_filename=template.original_filename,
        placeholders=[str(placeholder) for placeholder in (template.placeholders or [])],
        is_active=template.is_active,
        created_at=created_at.isoformat(),
    )


def resume_template_section_order(placeholders: list[str]) -> list[str]:
    order: list[str] = []
    for placeholder in placeholders:
        normalized = "SUMMARY" if placeholder.upper() == "PROFESSIONAL_SUMMARY" else placeholder.upper()
        if normalized in {"SUMMARY", "SKILLS", "EXPERIENCE", "PROJECTS", "EDUCATION", "CERTIFICATIONS"} and normalized not in order:
            order.append(normalized)
    return order


def preview_resume_content(profile: ResumeProfile | None) -> dict:
    if not profile:
        return {
            "professional_summary": "Upload a master resume to preview your real summary evidence.",
            "skills": ["Python", "React", "PostgreSQL"],
            "experience": [{"title": "Example Role", "company": "Example Company", "description": "Verified resume experience will render here."}],
            "projects": [{"name": "Example Project", "description": "Verified project evidence will render here.", "technologies": ["Python"]}],
            "education": [{"institution": "Example University", "degree": "Example Degree", "year": "2021"}],
            "certifications": [{"name": "Example Certification", "issuer": "Example Issuer", "year": "2022"}],
        }
    return {
        "professional_summary": " ".join((profile.extracted_text or "").split())[:600],
        "skills": list(profile.skills),
        "experience": [
            {"title": experience.title, "company": experience.company, "description": experience.description}
            for experience in profile.experiences
        ],
        "projects": [
            {"name": project.name, "description": project.description, "technologies": list(project.technologies)}
            for project in profile.projects
        ],
        "education": [
            {"institution": education.institution, "degree": education.degree, "year": education.year}
            for education in profile.education
        ],
        "certifications": [
            {"name": certification.name, "issuer": certification.issuer, "year": certification.year}
            for certification in profile.certifications
        ],
    }


def resume_version_response(version: ResumeVersion, job: Job, template: ResumeTemplate | None = None) -> ResumeVersionResponse:
    created_at = version.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return ResumeVersionResponse(
        id=str(version.id),
        job_id=str(job.id),
        job_title=job.title,
        company=job.company,
        ats_score=version.ats_score,
        template_id=str(version.template_id) if version.template_id else None,
        template_name=template.name if template else "Built-in ATS template",
        prompt_version=version.prompt_version,
        model_provider=version.model_provider,
        model_name=version.model_name,
        generation_status=version.generation_status,
        created_at=created_at.isoformat(),
    )


def resume_version_detail_response(version: ResumeVersion, job: Job, match: JobMatch | None = None, template: ResumeTemplate | None = None) -> ResumeVersionDetailResponse:
    base = resume_version_response(version, job, template)
    return ResumeVersionDetailResponse(
        **base.model_dump(),
        resume_content=version.resume_content,
        quality_warnings=[str(warning) for warning in (version.quality_warnings or [])],
        ats_improvement_suggestions=[str(item) for item in ((match.ats_recommendations if match else []) or [])],
        missing_skills_analysis=[str(item) for item in ((match.missing_skills if match else []) or [])],
        matching_skills=[str(item) for item in ((match.matching_skills if match else []) or [])],
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
    cleaned["projects"] = [
        {
            "name": str(project.get("name", "")).strip()[:255],
            "description": str(project.get("description", "")).strip()[:4000],
            "technologies": [str(technology).strip()[:120] for technology in (project.get("technologies") or []) if str(technology).strip()] if isinstance(project.get("technologies"), list) else [],
        }
        for project in content.get("projects", [])
        if isinstance(project, dict) and str(project.get("name", "")).strip()
    ]
    cleaned["education"] = [
        {
            "institution": str(education.get("institution", "")).strip()[:255],
            "degree": str(education.get("degree", "")).strip()[:255],
            "year": str(education.get("year", "")).strip()[:32] if education.get("year") else None,
        }
        for education in content.get("education", [])
        if isinstance(education, dict) and str(education.get("institution", "")).strip()
    ]
    cleaned["certifications"] = [
        {
            "name": str(certification.get("name", "")).strip()[:255],
            "issuer": str(certification.get("issuer", "")).strip()[:255] if certification.get("issuer") else None,
            "year": str(certification.get("year", "")).strip()[:32] if certification.get("year") else None,
        }
        for certification in content.get("certifications", [])
        if isinstance(certification, dict) and str(certification.get("name", "")).strip()
    ]
    return cleaned


def resume_content_summary(content: dict) -> str:
    summary = str(content.get("professional_summary", "")).strip()
    skills = content.get("skills") if isinstance(content.get("skills"), list) else []
    experience = content.get("experience") if isinstance(content.get("experience"), list) else []
    parts: list[str] = []
    if summary:
        parts.append(summary[:280])
    if skills:
        parts.append(f"Skills: {', '.join(str(skill) for skill in skills[:8])}")
    if experience and isinstance(experience[0], dict):
        first = experience[0]
        title = str(first.get("title", "")).strip()
        company = str(first.get("company", "")).strip()
        description = str(first.get("description", "")).strip()
        parts.append(f"Experience: {title} at {company}. {description[:220]}".strip())
    return " ".join(parts)[:900] or "Tailored resume version is prepared. Open the resume editor for full details."


def cover_letter_response(cover_letter: CoverLetter) -> CoverLetterResponse:
    created_at = cover_letter.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return CoverLetterResponse(
        id=str(cover_letter.id),
        job_id=str(cover_letter.job_id),
        content=cover_letter.content,
        ats_score=cover_letter.ats_score,
        prompt_version=cover_letter.prompt_version,
        model_provider=cover_letter.model_provider,
        model_name=cover_letter.model_name,
        generation_status=cover_letter.generation_status,
        quality_warnings=[str(warning) for warning in (cover_letter.quality_warnings or [])],
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


def log_activity(session: AsyncSession, user_id: UUID, event_type: str, metadata: dict | None = None) -> None:
    session.add(ActivityLog(user_id=user_id, event_type=event_type, metadata_=metadata or {}))


def activity_log_response(log: ActivityLog) -> ActivityLogResponse:
    created_at = log.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return ActivityLogResponse(
        id=str(log.id),
        event_type=log.event_type,
        metadata=log.metadata_,
        created_at=created_at.isoformat(),
    )


def isoformat(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def resume_profile_export(profile: ResumeProfile) -> dict:
    return {
        "id": str(profile.id),
        "original_filename": profile.original_filename,
        "mime_type": profile.mime_type,
        "parse_status": profile.parse_status,
        "extracted_text": profile.extracted_text,
        "detected_sections": list(profile.detected_sections),
        "skills": list(profile.skills),
        "experiences": [
            {"title": experience.title, "company": experience.company, "description": experience.description}
            for experience in profile.experiences
        ],
        "education": [
            {"institution": item.institution, "degree": item.degree, "year": item.year}
            for item in profile.education
        ],
        "certifications": [
            {"name": item.name, "issuer": item.issuer, "year": item.year}
            for item in profile.certifications
        ],
        "projects": [
            {"name": item.name, "description": item.description, "technologies": list(item.technologies)}
            for item in profile.projects
        ],
    }


def job_export(job: Job) -> dict:
    return {
        "id": str(job.id),
        "source": job.source,
        "external_id": job.external_id,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "salary": job.salary,
        "url": job.url,
        "description": job.description,
        "created_at": isoformat(job.created_at),
    }


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


@router.patch("/resumes/me", response_model=ResumeProfileResponse)
async def update_my_resume_profile(
    payload: ResumeProfileUpdateRequest,
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeProfileResponse:
    try:
        profile = await ResumeService(session).update_profile(
            user.id,
            skills=[skill.strip() for skill in payload.skills if skill.strip()],
            experiences=[
                ResumeExperience(
                    title=item.title.strip(),
                    company=item.company.strip(),
                    description=item.description.strip(),
                )
                for item in payload.experiences
            ],
            education=[
                ResumeEducation(
                    institution=item.institution.strip(),
                    degree=item.degree.strip(),
                    year=item.year.strip() if item.year else None,
                )
                for item in payload.education
            ],
            certifications=[
                ResumeCertification(
                    name=item.name.strip(),
                    issuer=item.issuer.strip() if item.issuer else None,
                    year=item.year.strip() if item.year else None,
                )
                for item in payload.certifications
            ],
            projects=[
                ResumeProject(
                    name=item.name.strip(),
                    description=item.description.strip(),
                    technologies=tuple(technology.strip() for technology in item.technologies if technology.strip()),
                )
                for item in payload.projects
            ],
        )
    except ResumeValidationError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    log_activity(
        session,
        user.id,
        "resume_profile_updated",
        {
            "resume_id": str(profile.id),
            "skill_count": len(profile.skills),
            "experience_count": len(profile.experiences),
            "education_count": len(profile.education),
            "certification_count": len(profile.certifications),
            "project_count": len(profile.projects),
        },
    )
    await session.commit()
    return resume_profile_response(profile)


@router.post("/resumes/reparse", response_model=ResumeProfileResponse)
async def reparse_my_resume(
    user: Annotated[UserRecord, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeProfileResponse:
    try:
        profile = await ResumeService(session).reparse_active(user.id)
    except ResumeValidationError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    log_activity(
        session,
        user.id,
        "resume_reparsed",
        {
            "resume_id": str(profile.id),
            "skill_count": len(profile.skills),
            "experience_count": len(profile.experiences),
            "education_count": len(profile.education),
            "certification_count": len(profile.certifications),
            "project_count": len(profile.projects),
        },
    )
    await session.commit()
    return resume_profile_response(profile)


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
    log_activity(
        session,
        user.id,
        "resume_uploaded",
        {
            "resume_id": str(profile.id),
            "filename": profile.original_filename,
            "mime_type": profile.mime_type,
        },
    )
    log_activity(
        session,
        user.id,
        "resume_parsed",
        {
            "resume_id": str(profile.id),
            "skill_count": len(profile.skills),
            "experience_count": len(profile.experiences),
            "education_count": len(profile.education),
            "certification_count": len(profile.certifications),
            "project_count": len(profile.projects),
            "detected_sections": list(profile.detected_sections),
        },
    )
    await session.commit()
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
        projects=[
            ResumeProjectResponse(name=item.name, description=item.description, technologies=list(item.technologies))
            for item in profile.projects
        ],
    )
