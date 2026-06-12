import re
from dataclasses import dataclass

from app.application.resumes.service import ResumeProfile
from app.infrastructure.db.models import CoverLetter, Job, ResumeVersion, User


@dataclass(frozen=True)
class AutofillMapping:
    field_key: str
    label: str
    value: str
    confidence: float
    source: str
    sensitive: bool = False
    requires_review: bool = False


EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_PATTERN = re.compile(r"(?:\+?\d[\d\s().-]{7,}\d)")
LINKEDIN_PATTERN = re.compile(r"https?://(?:www\.)?linkedin\.com/[^\s,)]+", re.IGNORECASE)
GITHUB_PATTERN = re.compile(r"https?://(?:www\.)?github\.com/[^\s,)]+", re.IGNORECASE)
URL_PATTERN = re.compile(r"https?://[^\s,)]+", re.IGNORECASE)


def build_autofill_plan(
    *,
    user: User,
    profile: ResumeProfile,
    job: Job,
    resume_version: ResumeVersion | None,
    cover_letter: CoverLetter | None,
) -> list[AutofillMapping]:
    text = profile.extracted_text or ""
    email = first_match(EMAIL_PATTERN, text) or user.email
    phone = first_match(PHONE_PATTERN, text)
    linkedin = first_match(LINKEDIN_PATTERN, text)
    github = first_match(GITHUB_PATTERN, text)
    portfolio = first_portfolio_url(text, linkedin, github)
    current_experience = profile.experiences[0] if profile.experiences else None
    education = profile.education[0] if profile.education else None
    full_name = infer_name(text, email)
    name_parts = full_name.split()
    first_name = name_parts[0] if name_parts else ""
    last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
    location = infer_location(text)

    mappings = [
        maybe_mapping("full_name", "Full name", full_name, 0.66 if full_name else 0, "resume header"),
        maybe_mapping("first_name", "First name", first_name, 0.72 if first_name else 0, "resume header"),
        maybe_mapping("last_name", "Last name", last_name, 0.72 if last_name else 0, "resume header"),
        maybe_mapping("email", "Email", email, 0.98, "account/resume", sensitive=True),
        maybe_mapping("phone", "Phone", phone, 0.86 if phone else 0, "resume", sensitive=True),
        maybe_mapping("location", "Location", location, 0.58 if location else 0, "resume"),
        maybe_mapping("linkedin", "LinkedIn", linkedin, 0.9 if linkedin else 0, "resume"),
        maybe_mapping("github", "GitHub", github, 0.9 if github else 0, "resume"),
        maybe_mapping("portfolio", "Portfolio", portfolio, 0.74 if portfolio else 0, "resume"),
        maybe_mapping("current_company", "Current company", current_experience.company if current_experience else "", 0.82 if current_experience else 0, "latest resume experience"),
        maybe_mapping("current_role", "Current role", current_experience.title if current_experience else "", 0.82 if current_experience else 0, "latest resume experience"),
        maybe_mapping("work_experience", "Work experience", summarize_experience(profile), 0.84 if profile.experiences else 0, "resume experience"),
        maybe_mapping("education", "Education", summarize_education(profile), 0.84 if profile.education else 0, "resume education"),
        maybe_mapping("skills", "Skills", ", ".join(profile.skills[:30]), 0.92 if profile.skills else 0, "resume skills"),
        maybe_mapping("cover_letter", "Cover letter", cover_letter.content if cover_letter else "", 0.9 if cover_letter else 0, "prepared cover letter"),
        maybe_mapping("expected_salary", "Expected salary", "", 0, "manual only", sensitive=True),
        maybe_mapping("notice_period", "Notice period", "", 0, "manual only"),
        maybe_mapping("work_authorization", "Work authorization", "", 0, "manual only", sensitive=True),
        maybe_mapping("pronouns", "Pronouns", "", 0, "manual only", sensitive=True),
        maybe_mapping("resume_file", "Tailored resume file", str(resume_version.id) if resume_version else "", 0.95 if resume_version else 0, "prepared resume version"),
    ]
    return [mapping for mapping in mappings if mapping is not None]


def maybe_mapping(
    field_key: str,
    label: str,
    value: str | None,
    confidence: float,
    source: str,
    *,
    sensitive: bool = False,
) -> AutofillMapping | None:
    value = (value or "").strip()
    if not value and field_key not in {"expected_salary", "notice_period", "work_authorization", "pronouns"}:
        return None
    confidence = max(0, min(confidence, 1))
    return AutofillMapping(
        field_key=field_key,
        label=label,
        value=value,
        confidence=round(confidence, 2),
        source=source,
        sensitive=sensitive,
        requires_review=sensitive or confidence < 0.75,
    )


def first_match(pattern: re.Pattern[str], text: str) -> str:
    match = pattern.search(text)
    return match.group(0).strip(" .,:;") if match else ""


def first_portfolio_url(text: str, linkedin: str, github: str) -> str:
    for match in URL_PATTERN.finditer(text):
        url = match.group(0).strip(" .,:;")
        if url != linkedin and url != github and "linkedin.com" not in url.lower() and "github.com" not in url.lower():
            return url
    return ""


def infer_name(text: str, email: str) -> str:
    for line in text.splitlines()[:8]:
        cleaned = re.sub(r"[^A-Za-z .'-]", "", line).strip()
        words = cleaned.split()
        if 2 <= len(words) <= 4 and not EMAIL_PATTERN.search(line) and not URL_PATTERN.search(line):
            return " ".join(word.capitalize() for word in words)
    local = email.split("@", 1)[0].replace(".", " ").replace("_", " ").replace("-", " ")
    words = [word for word in local.split() if word]
    return " ".join(word.capitalize() for word in words[:3])


def infer_location(text: str) -> str:
    for line in text.splitlines()[:15]:
        lowered = line.lower()
        if any(token in lowered for token in ("india", "remote", "bengaluru", "bangalore", "mumbai", "delhi", "pune", "hyderabad", "chennai")):
            return re.sub(r"\s+", " ", line).strip()[:120]
    return ""


def summarize_experience(profile: ResumeProfile) -> str:
    return "\n".join(
        f"{item.title} at {item.company}: {item.description}".strip()
        for item in profile.experiences[:3]
    )


def summarize_education(profile: ResumeProfile) -> str:
    return "\n".join(
        f"{item.degree}, {item.institution}{f' ({item.year})' if item.year else ''}"
        for item in profile.education[:3]
    )
