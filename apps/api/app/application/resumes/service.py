from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import re
from uuid import UUID

import fitz
from docx import Document
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models import Experience, MasterResume, Skill


MAX_RESUME_BYTES = 10 * 1024 * 1024
SUPPORTED_RESUME_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}
SECTION_NAMES = ("summary", "experience", "education", "skills", "projects", "certifications")
SKILL_ALIASES = {
    "amazon web services": "AWS",
    "aws": "AWS",
    "docker": "Docker",
    "fastapi": "FastAPI",
    "git": "Git",
    "graphql": "GraphQL",
    "java": "Java",
    "javascript": "JavaScript",
    "kubernetes": "Kubernetes",
    "machine learning": "Machine Learning",
    "mongodb": "MongoDB",
    "mysql": "MySQL",
    "next.js": "Next.js",
    "node.js": "Node.js",
    "postgresql": "PostgreSQL",
    "python": "Python",
    "react": "React",
    "redis": "Redis",
    "sql": "SQL",
    "tailwind css": "Tailwind CSS",
    "typescript": "TypeScript",
}


class ResumeValidationError(ValueError):
    pass


@dataclass(frozen=True)
class ResumeProfile:
    id: UUID
    original_filename: str
    mime_type: str
    parse_status: str
    extracted_text: str
    detected_sections: tuple[str, ...]
    skills: tuple[str, ...]
    experiences: tuple["ResumeExperience", ...]


@dataclass(frozen=True)
class ResumeExperience:
    title: str
    company: str
    description: str


class ResumeService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upload(self, user_id: UUID, filename: str, content_type: str, content: bytes) -> ResumeProfile:
        validate_resume(filename, content_type, content)
        extracted_text = extract_resume_text(content_type, content)
        if len(extracted_text.strip()) < 30:
            raise ResumeValidationError("Resume text could not be extracted. Upload a text-based PDF or DOCX file.")

        await self._session.execute(
            update(MasterResume)
            .where(MasterResume.user_id == user_id, MasterResume.is_active.is_(True))
            .values(is_active=False)
        )
        resume = MasterResume(
            user_id=user_id,
            storage_key=f"database-extract-only/{user_id}/{Path(filename).name}",
            original_filename=Path(filename).name,
            mime_type=content_type,
            extracted_text=extracted_text,
            parse_status="review_required",
            is_active=True,
        )
        self._session.add(resume)
        await self._session.flush()
        for normalized_name, display_name in detect_skills(extracted_text):
            self._session.add(
                Skill(
                    resume_id=resume.id,
                    user_id=user_id,
                    skill_name=display_name,
                    normalized_name=normalized_name,
                    confidence_score=1.0,
                    evidence={"source": "resume_text"},
                )
            )
        for index, experience in enumerate(detect_experiences(extracted_text)):
            self._session.add(
                Experience(
                    resume_id=resume.id,
                    user_id=user_id,
                    company=experience.company,
                    title=experience.title,
                    description=experience.description,
                    sort_order=index,
                )
            )
        await self._session.commit()
        profile = await self.get_active(user_id)
        if not profile:
            raise RuntimeError("Active resume was not persisted.")
        return profile

    async def get_active(self, user_id: UUID) -> ResumeProfile | None:
        resume = await self._session.scalar(
            select(MasterResume)
            .options(selectinload(MasterResume.skills), selectinload(MasterResume.experiences))
            .where(MasterResume.user_id == user_id, MasterResume.is_active.is_(True))
            .order_by(MasterResume.created_at.desc())
        )
        return to_profile(resume) if resume else None


def validate_resume(filename: str, content_type: str, content: bytes) -> None:
    suffix = Path(filename).suffix.lower()
    if content_type not in SUPPORTED_RESUME_TYPES or suffix != SUPPORTED_RESUME_TYPES[content_type]:
        raise ResumeValidationError("Upload a PDF or DOCX resume.")
    if not content:
        raise ResumeValidationError("Resume file is empty.")
    if len(content) > MAX_RESUME_BYTES:
        raise ResumeValidationError("Resume file must be 10 MB or smaller.")


def extract_resume_text(content_type: str, content: bytes) -> str:
    try:
        if content_type == "application/pdf":
            with fitz.open(stream=content, filetype="pdf") as document:
                text = "\n".join(page.get_text() for page in document)
        else:
            document = Document(BytesIO(content))
            text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    except Exception as error:
        raise ResumeValidationError("Resume file could not be read.") from error
    return clean_text(text)


def clean_text(text: str) -> str:
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def detect_sections(text: str) -> tuple[str, ...]:
    lowered = text.lower()
    return tuple(section for section in SECTION_NAMES if re.search(rf"\b{section}\b", lowered))


def detect_skills(text: str) -> tuple[tuple[str, str], ...]:
    lowered = text.lower()
    skills = [
        (alias, display_name)
        for alias, display_name in SKILL_ALIASES.items()
        if re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", lowered)
    ]
    unique = {display_name.lower(): (display_name.lower(), display_name) for _, display_name in skills}
    return tuple(sorted(unique.values()))


def detect_experiences(text: str) -> tuple[ResumeExperience, ...]:
    lines = text.splitlines()
    section_start = next((index for index, line in enumerate(lines) if line.lower() == "experience"), None)
    if section_start is None:
        return ()
    section_end = next(
        (index for index in range(section_start + 1, len(lines)) if lines[index].lower() in SECTION_NAMES),
        len(lines),
    )
    content = lines[section_start + 1 : section_end]
    experiences = []
    for index in range(0, len(content) - 1, 3):
        title, company = content[index : index + 2]
        description = content[index + 2] if index + 2 < len(content) else ""
        if title and company:
            experiences.append(ResumeExperience(title=title, company=company, description=description))
    return tuple(experiences)


def to_profile(resume: MasterResume) -> ResumeProfile:
    extracted_text = resume.extracted_text or ""
    return ResumeProfile(
        id=resume.id,
        original_filename=resume.original_filename,
        mime_type=resume.mime_type,
        parse_status=resume.parse_status,
        extracted_text=extracted_text,
        detected_sections=detect_sections(extracted_text),
        skills=tuple(sorted(skill.skill_name for skill in resume.skills)),
        experiences=tuple(
            ResumeExperience(title=experience.title, company=experience.company, description=experience.description)
            for experience in sorted(resume.experiences, key=lambda item: item.sort_order)
        ),
    )
