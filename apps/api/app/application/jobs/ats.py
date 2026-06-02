from dataclasses import dataclass

from app.application.resumes.service import ResumeProfile
from app.domain.jobs.entities import Job


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
        required_skills = {skill.lower() for skill in job.required_skills}
        keyword_score = round((len(required_skills & resume_skills) / max(len(required_skills), 1)) * 100)
        detected_sections = set(profile.detected_sections)
        expected_sections = {"summary", "experience", "education", "skills"}
        section_score = round((len(expected_sections & detected_sections) / len(expected_sections)) * 100)
        formatting_score = 100 if profile.mime_type.endswith("document") else 90
        parse_score = 100 if len(profile.extracted_text) >= 200 and profile.skills else 70
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
        if keyword_score < 80:
            recommendations.append("Review missing job keywords and add only truthful evidence-backed terms.")
        if section_score < 100:
            recommendations.append("Use clear Summary, Experience, Education, and Skills headings.")
        if formatting_score < 100:
            recommendations.append("Prefer a simple DOCX export when the employer accepts it.")
        if parse_score < 100:
            recommendations.append("Review the extracted resume text before applying.")
        return AtsResult(score=score, breakdown=breakdown, recommendations=tuple(recommendations))
