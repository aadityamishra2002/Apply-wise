import json
from dataclasses import dataclass

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.application.resumes.service import ResumeProfile
from app.infrastructure.db.models import Job


class GeneratedDraft(BaseModel):
    professional_summary: str = Field(min_length=20, max_length=1200)
    cover_letter: str = Field(min_length=80, max_length=6000)


@dataclass(frozen=True)
class TailoredMaterials:
    resume_content: dict
    cover_letter: str
    provenance: str


class GeminiTailoringService:
    def __init__(self, api_key: str = "", model: str = "gemini-2.5-flash", timeout_seconds: float = 20) -> None:
        self._api_key = api_key
        self._model = model
        self._timeout_seconds = timeout_seconds

    def prepare(self, job: Job, profile: ResumeProfile) -> TailoredMaterials:
        fallback = build_fallback_materials(job, profile)
        if not self._api_key:
            return fallback
        try:
            generated = self._generate(job, profile)
        except (httpx.HTTPError, KeyError, TypeError, ValueError, ValidationError, json.JSONDecodeError):
            return fallback
        resume_content = dict(fallback.resume_content)
        resume_content["professional_summary"] = generated.professional_summary
        resume_content["draft_type"] = "gemini_evidence_grounded"
        return TailoredMaterials(
            resume_content=resume_content,
            cover_letter=generated.cover_letter,
            provenance="gemini_evidence_grounded",
        )

    def _generate(self, job: Job, profile: ResumeProfile) -> GeneratedDraft:
        evidence = build_evidence(profile)
        response = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{self._model}:generateContent",
            params={"key": self._api_key},
            json={
                "contents": [{"parts": [{"text": build_prompt(job, evidence)}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "responseSchema": {
                        "type": "OBJECT",
                        "properties": {
                            "professional_summary": {"type": "STRING"},
                            "cover_letter": {"type": "STRING"},
                        },
                        "required": ["professional_summary", "cover_letter"],
                    },
                },
            },
            timeout=self._timeout_seconds,
        )
        response.raise_for_status()
        text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        draft = GeneratedDraft.model_validate_json(text)
        validate_generated_text(draft, evidence)
        return draft


def build_fallback_materials(job: Job, profile: ResumeProfile) -> TailoredMaterials:
    return TailoredMaterials(
        resume_content={
            "draft_type": "deterministic_evidence_grounded",
            "target_role": job.title,
            "target_company": job.company,
            "skills": list(profile.skills),
            "experience": [
                {"title": experience.title, "company": experience.company, "description": experience.description}
                for experience in profile.experiences
            ],
            "source_resume_id": str(profile.id),
        },
        cover_letter=build_cover_letter(job, profile),
        provenance="deterministic_evidence_grounded",
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


def build_evidence(profile: ResumeProfile) -> dict:
    return {
        "skills": list(profile.skills),
        "experience": [
            {"title": experience.title, "company": experience.company, "description": experience.description}
            for experience in profile.experiences
        ],
    }


def build_prompt(job: Job, evidence: dict) -> str:
    return (
        "Create a concise ATS-aware professional summary and tailored cover letter. "
        "Use only facts present in RESUME_EVIDENCE. Do not invent employers, skills, projects, metrics, responsibilities, or achievements. "
        "Mention only skills and employers explicitly present in RESUME_EVIDENCE. Return JSON only.\n\n"
        f"TARGET_ROLE: {job.title}\nTARGET_COMPANY: {job.company}\nJOB_DESCRIPTION: {job.description}\n"
        f"RESUME_EVIDENCE: {json.dumps(evidence)}"
    )


def validate_generated_text(draft: GeneratedDraft, evidence: dict) -> None:
    evidence_text = json.dumps(evidence).lower()
    generated_text = f"{draft.professional_summary} {draft.cover_letter}".lower()
    for token in ("fabricated", "invented", "placeholder"):
        if token in generated_text:
            raise ValueError("Generated text failed grounding validation.")
    employers = [experience["company"].lower() for experience in evidence["experience"]]
    if employers and not any(employer in evidence_text for employer in employers):
        raise ValueError("Resume evidence is invalid.")
