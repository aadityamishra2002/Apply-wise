from dataclasses import dataclass
import re

from app.application.resumes.service import ResumeProfile, detect_skills
from app.domain.jobs.entities import Job


IMPORTANT_TERM_PATTERN = re.compile(r"\b(?:api|apis|backend|frontend|fullstack|full-stack|saas|cloud|database|microservices|automation|testing|ci/cd|devops|analytics|security|machine learning|ai|llm|etl|rest|graphql)\b", re.IGNORECASE)


@dataclass(frozen=True)
class AtsWeights:
    keywords: float
    sections: float
    formatting: float
    parse_readiness: float

    def __post_init__(self) -> None:
        if round(self.keywords + self.sections + self.formatting + self.parse_readiness, 6) != 1:
            raise ValueError("ATS weights must sum to 1.")


@dataclass(frozen=True)
class AtsResult:
    score: int
    breakdown: dict[str, int]
    recommendations: tuple[str, ...]


class AtsAnalysisService:
    def __init__(self, weights: AtsWeights) -> None:
        self._weights = weights

    def analyze(self, job: Job, profile: ResumeProfile) -> AtsResult:
        resume_skills = {skill.lower() for skill in profile.skills}
        required_skills = job_keywords(job)
        keyword_score = round((len(required_skills & resume_skills) / max(len(required_skills), 1)) * 100)
        detected_sections = set(profile.detected_sections)
        expected_sections = {"summary", "experience", "education", "skills"}
        section_score = round((len(expected_sections & detected_sections) / len(expected_sections)) * 100)
        formatting_score = formatting_readiness(profile)
        parse_score = parse_readiness(profile)
        breakdown = {
            "keywords": keyword_score,
            "sections": section_score,
            "formatting": formatting_score,
            "parse_readiness": parse_score,
        }
        score = round(
            keyword_score * self._weights.keywords
            + section_score * self._weights.sections
            + formatting_score * self._weights.formatting
            + parse_score * self._weights.parse_readiness
        )
        recommendations = []
        missing_keywords = sorted(required_skills - resume_skills)
        if keyword_score < 80:
            preview = ", ".join(missing_keywords[:6])
            suffix = f" Missing or weak keywords: {preview}." if preview else ""
            recommendations.append(f"Review missing job keywords and add only truthful evidence-backed terms.{suffix}")
        if section_score < 100:
            recommendations.append("Use clear Summary, Experience, Education, and Skills headings.")
        if formatting_score < 100:
            recommendations.append("Prefer a simple DOCX export when the employer accepts it.")
        if parse_score < 100:
            recommendations.append("Review the extracted resume text before applying.")
        return AtsResult(score=score, breakdown=breakdown, recommendations=tuple(recommendations))


def job_keywords(job: Job) -> set[str]:
    explicit = {skill.strip().lower() for skill in job.required_skills if skill.strip()}
    if explicit:
        return explicit
    text = f"{job.title} {job.description}"
    detected = {skill.lower() for skill, _confidence in detect_skills(text)}
    important_terms = {match.group(0).lower() for match in IMPORTANT_TERM_PATTERN.finditer(text)}
    return detected | important_terms or {"resume"}


def formatting_readiness(profile: ResumeProfile) -> int:
    if profile.mime_type.endswith("document"):
        return 100
    text = profile.extracted_text
    if profile.mime_type == "application/pdf" and len(text) >= 200:
        return 90
    if len(text) >= 120:
        return 80
    return 65


def parse_readiness(profile: ResumeProfile) -> int:
    score = 0
    if len(profile.extracted_text) >= 200:
        score += 35
    elif len(profile.extracted_text) >= 80:
        score += 20
    if profile.skills:
        score += 25
    if profile.experiences:
        score += 20
    if profile.education:
        score += 10
    if profile.detected_sections:
        score += 10
    return min(score, 100)
