import re
from dataclasses import dataclass

from app.application.resumes.service import ResumeProfile, detect_skills


METRIC_PATTERN = re.compile(r"(\b\d+%|\$\s?\d+|\b\d+x\b|\b\d+\s?(?:k|m|million|billion)\b)", re.IGNORECASE)


@dataclass(frozen=True)
class QualityWarning:
    category: str
    message: str
    severity: str = "warning"


def find_unsupported_claims(resume_content: dict | None, cover_letter: str | None, profile: ResumeProfile) -> list[QualityWarning]:
    evidence_text = build_evidence_text(profile)
    generated_text = build_generated_text(resume_content, cover_letter)
    warnings: list[QualityWarning] = []
    warnings.extend(find_unsupported_skills(generated_text, resume_content or {}, profile))
    warnings.extend(find_unsupported_experience(resume_content or {}, profile))
    warnings.extend(find_unsupported_metrics(generated_text, evidence_text))
    return dedupe_warnings(warnings)


def build_evidence_text(profile: ResumeProfile) -> str:
    parts = [profile.extracted_text or "", *profile.skills]
    for experience in profile.experiences:
        parts.extend([experience.title, experience.company, experience.description])
    for education in profile.education:
        parts.extend([education.institution, education.degree, education.year or ""])
    for certification in profile.certifications:
        parts.extend([certification.name, certification.issuer or "", certification.year or ""])
    for project in profile.projects:
        parts.extend([project.name, project.description, *project.technologies])
    return " ".join(parts).lower()


def build_generated_text(resume_content: dict | None, cover_letter: str | None) -> str:
    parts: list[str] = [cover_letter or ""]
    if resume_content:
        for value in resume_content.values():
            if isinstance(value, str):
                parts.append(value)
            elif isinstance(value, list):
                parts.extend(flatten_list_text(value))
    return " ".join(parts).lower()


def flatten_list_text(values: list) -> list[str]:
    text: list[str] = []
    for value in values:
        if isinstance(value, str):
            text.append(value)
        elif isinstance(value, dict):
            text.extend(str(item) for item in value.values() if item is not None)
    return text


def find_unsupported_skills(generated_text: str, resume_content: dict, profile: ResumeProfile) -> list[QualityWarning]:
    known_skills = {skill.lower() for skill in profile.skills}
    known_skills.update(technology.lower() for project in profile.projects for technology in project.technologies)
    warnings: list[QualityWarning] = []
    for skill in resume_content.get("skills", []):
        skill_name = str(skill).strip()
        if skill_name and skill_name.lower() not in known_skills:
            warnings.append(QualityWarning("unsupported_skill", f"Skill '{skill_name}' appears in generated material but was not found in the master resume."))
    for skill, _confidence in detect_skills(generated_text):
        if skill.lower() not in known_skills:
            warnings.append(QualityWarning("unsupported_skill", f"Skill '{skill}' appears in generated material but was not found in the master resume."))
    return warnings


def find_unsupported_experience(resume_content: dict, profile: ResumeProfile) -> list[QualityWarning]:
    known_companies = {experience.company.strip().lower() for experience in profile.experiences}
    known_titles = {experience.title.strip().lower() for experience in profile.experiences}
    warnings: list[QualityWarning] = []
    for item in resume_content.get("experience", []):
        if not isinstance(item, dict):
            continue
        company = str(item.get("company", "")).strip()
        title = str(item.get("title", "")).strip()
        if company and known_companies and company.lower() not in known_companies:
            warnings.append(QualityWarning("unsupported_company", f"Company '{company}' is not present in the master resume."))
        if title and known_titles and title.lower() not in known_titles:
            warnings.append(QualityWarning("unsupported_title", f"Title '{title}' is not present in the master resume."))
    return warnings


def find_unsupported_metrics(generated_text: str, evidence_text: str) -> list[QualityWarning]:
    warnings: list[QualityWarning] = []
    for metric in {match.group(0).lower() for match in METRIC_PATTERN.finditer(generated_text)}:
        if metric not in evidence_text:
            warnings.append(QualityWarning("unsupported_metric", f"Metric '{metric}' appears in generated material but was not found in the master resume."))
    return warnings


def dedupe_warnings(warnings: list[QualityWarning]) -> list[QualityWarning]:
    seen: set[tuple[str, str]] = set()
    result: list[QualityWarning] = []
    for warning in warnings:
        key = (warning.category, warning.message)
        if key in seen:
            continue
        seen.add(key)
        result.append(warning)
    return result
