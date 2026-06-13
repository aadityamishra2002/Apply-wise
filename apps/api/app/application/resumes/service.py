from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import re
from uuid import UUID

import fitz
from docx import Document
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db.models import Certification, Education, Experience, MasterResume, Project, Skill


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
    education: tuple["ResumeEducation", ...] = ()
    certifications: tuple["ResumeCertification", ...] = ()
    projects: tuple["ResumeProject", ...] = ()


@dataclass(frozen=True)
class ResumeExperience:
    title: str
    company: str
    description: str


@dataclass(frozen=True)
class ResumeEducation:
    institution: str
    degree: str
    year: str | None


@dataclass(frozen=True)
class ResumeCertification:
    name: str
    issuer: str | None
    year: str | None


@dataclass(frozen=True)
class ResumeProject:
    name: str
    description: str
    technologies: tuple[str, ...] = ()


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
        await self._replace_structured_profile(resume, user_id, extracted_text)
        await self._session.commit()
        profile = await self.get_active(user_id)
        if not profile:
            raise RuntimeError("Active resume was not persisted.")
        return profile

    async def update_profile(
        self,
        user_id: UUID,
        *,
        skills: list[str],
        experiences: list[ResumeExperience],
        education: list[ResumeEducation],
        certifications: list[ResumeCertification],
        projects: list[ResumeProject],
    ) -> ResumeProfile:
        resume = await self._get_active_row(user_id)
        if not resume:
            raise ResumeValidationError("Upload a master resume before editing your profile.")
        await self._clear_structured_profile(resume.id)
        await self._persist_structured_profile(
            resume,
            user_id,
            tuple((normalize_skill_name(skill), skill.strip()) for skill in skills if skill.strip()),
            tuple(experiences),
            tuple(education),
            tuple(certifications),
            tuple(projects),
            evidence_source="user_review",
        )
        resume.parse_status = "reviewed"
        await self._session.commit()
        refreshed = await self.get_active(user_id)
        if not refreshed:
            raise RuntimeError("Active resume was not persisted.")
        return refreshed

    async def reparse_active(self, user_id: UUID) -> ResumeProfile:
        resume = await self._get_active_row(user_id)
        if not resume or not resume.extracted_text:
            raise ResumeValidationError("Upload a master resume before reparsing.")
        await self._clear_structured_profile(resume.id)
        await self._replace_structured_profile(resume, user_id, resume.extracted_text)
        resume.parse_status = "review_required"
        await self._session.commit()
        refreshed = await self.get_active(user_id)
        if not refreshed:
            raise RuntimeError("Active resume was not persisted.")
        return refreshed

    async def _replace_structured_profile(self, resume: MasterResume, user_id: UUID, extracted_text: str) -> None:
        await self._persist_structured_profile(
            resume,
            user_id,
            detect_skills(extracted_text),
            detect_experiences(extracted_text),
            detect_education(extracted_text),
            detect_certifications(extracted_text),
            detect_projects(extracted_text),
            evidence_source="resume_text",
        )

    async def _persist_structured_profile(
        self,
        resume: MasterResume,
        user_id: UUID,
        skills: tuple[tuple[str, str], ...],
        experiences: tuple[ResumeExperience, ...],
        education: tuple[ResumeEducation, ...],
        certifications: tuple[ResumeCertification, ...],
        projects: tuple[ResumeProject, ...],
        *,
        evidence_source: str,
    ) -> None:
        seen_skills: set[str] = set()
        for normalized_name, display_name in skills:
            normalized_name = normalize_skill_name(normalized_name)
            display_name = display_name.strip()
            if not normalized_name or not display_name or normalized_name in seen_skills:
                continue
            seen_skills.add(normalized_name)
            self._session.add(
                Skill(
                    resume_id=resume.id,
                    user_id=user_id,
                    skill_name=display_name,
                    normalized_name=normalized_name,
                    confidence_score=1.0,
                    evidence={"source": evidence_source},
                )
            )
        for index, experience in enumerate(experiences):
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
        for index, education_item in enumerate(education):
            self._session.add(
                Education(
                    resume_id=resume.id,
                    user_id=user_id,
                    institution=education_item.institution,
                    degree=education_item.degree,
                    year=education_item.year,
                    sort_order=index,
                )
            )
        for index, certification in enumerate(certifications):
            self._session.add(
                Certification(
                    resume_id=resume.id,
                    user_id=user_id,
                    name=certification.name,
                    issuer=certification.issuer,
                    year=certification.year,
                    sort_order=index,
                )
            )
        for index, project in enumerate(projects):
            self._session.add(
                Project(
                    resume_id=resume.id,
                    user_id=user_id,
                    name=project.name,
                    description=project.description,
                    technologies=list(project.technologies),
                    sort_order=index,
                )
            )

    async def _clear_structured_profile(self, resume_id: UUID) -> None:
        await self._session.execute(delete(Skill).where(Skill.resume_id == resume_id))
        await self._session.execute(delete(Experience).where(Experience.resume_id == resume_id))
        await self._session.execute(delete(Education).where(Education.resume_id == resume_id))
        await self._session.execute(delete(Certification).where(Certification.resume_id == resume_id))
        await self._session.execute(delete(Project).where(Project.resume_id == resume_id))

    async def _get_active_row(self, user_id: UUID) -> MasterResume | None:
        return await self._session.scalar(
            select(MasterResume)
            .where(MasterResume.user_id == user_id, MasterResume.is_active.is_(True))
            .order_by(MasterResume.created_at.desc())
        )

    async def get_active(self, user_id: UUID) -> ResumeProfile | None:
        resume = await self._session.scalar(
            select(MasterResume)
            .options(
                selectinload(MasterResume.skills),
                selectinload(MasterResume.experiences),
                selectinload(MasterResume.education),
                selectinload(MasterResume.certifications),
                selectinload(MasterResume.projects),
            )
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


def normalize_skill_name(skill: str) -> str:
    return re.sub(r"\s+", " ", skill.strip().lower())


def detect_experiences(text: str) -> tuple[ResumeExperience, ...]:
    content = section_lines(text, "experience")
    experiences = []
    for index in range(0, len(content) - 1, 3):
        title, company = content[index : index + 2]
        description = content[index + 2] if index + 2 < len(content) else ""
        if title and company:
            experiences.append(ResumeExperience(title=title, company=company, description=description))
    return tuple(experiences)


def detect_education(text: str) -> tuple[ResumeEducation, ...]:
    education = []
    for line in section_lines(text, "education"):
        parts = split_structured_line(line)
        year = extract_year(line)
        if len(parts) >= 2:
            institution, degree = parts[0], parts[1]
        else:
            institution, degree = "Review source resume", parts[0]
        if degree:
            education.append(ResumeEducation(institution=institution, degree=degree, year=year))
    return tuple(education)


def detect_certifications(text: str) -> tuple[ResumeCertification, ...]:
    certifications = []
    for line in section_lines(text, "certifications"):
        parts = split_structured_line(line)
        year = extract_year(line)
        if not parts:
            continue
        certifications.append(
            ResumeCertification(
                name=parts[0],
                issuer=parts[1] if len(parts) > 1 else None,
                year=year,
            )
        )
    return tuple(certifications)


def detect_projects(text: str) -> tuple[ResumeProject, ...]:
    lines = section_lines(text, "projects")
    projects: list[ResumeProject] = []
    current_name: str | None = None
    current_description: list[str] = []
    for line in lines:
        cleaned = line.strip(" -•\t")
        if not cleaned:
            continue
        if current_name is None:
            current_name = cleaned
            continue
        if looks_like_project_heading(cleaned) and current_description:
            projects.append(build_project(current_name, current_description))
            current_name = cleaned
            current_description = []
        else:
            current_description.append(cleaned)
    if current_name:
        projects.append(build_project(current_name, current_description))
    return tuple(project for project in projects if project.name and project.description)


def looks_like_project_heading(line: str) -> bool:
    if len(line) > 90:
        return False
    if re.search(r"\b(built|created|developed|implemented|designed|deployed|integrated|managed)\b", line.lower()):
        return False
    return not line.endswith(".")


def build_project(name: str, description_lines: list[str]) -> ResumeProject:
    description = " ".join(description_lines).strip()
    normalized_description = description.lower()
    technologies = tuple(
        display_name
        for alias, display_name in SKILL_ALIASES.items()
        if re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", normalized_description)
    )
    unique_technologies = tuple(dict.fromkeys(technologies))
    return ResumeProject(name=name.strip(), description=description, technologies=unique_technologies)


def section_lines(text: str, section: str) -> list[str]:
    lines = text.splitlines()
    section_start = next((index for index, line in enumerate(lines) if line.lower() == section), None)
    if section_start is None:
        return []
    section_end = next(
        (index for index in range(section_start + 1, len(lines)) if lines[index].lower() in SECTION_NAMES),
        len(lines),
    )
    return [line for line in lines[section_start + 1 : section_end] if line.strip()]


def split_structured_line(line: str) -> list[str]:
    cleaned = re.sub(r"\b(19|20)\d{2}\b", "", line)
    return [part.strip(" -,\t") for part in re.split(r"\s+\|\s+|\s+-\s+|,\s*", cleaned) if part.strip(" -,\t")]


def extract_year(line: str) -> str | None:
    match = re.search(r"\b((?:19|20)\d{2})\b", line)
    return match.group(1) if match else None


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
        education=tuple(
            ResumeEducation(institution=item.institution, degree=item.degree, year=item.year)
            for item in sorted(resume.education, key=lambda entry: entry.sort_order)
        ),
        certifications=tuple(
            ResumeCertification(name=item.name, issuer=item.issuer, year=item.year)
            for item in sorted(resume.certifications, key=lambda entry: entry.sort_order)
        ),
        projects=tuple(
            ResumeProject(name=item.name, description=item.description, technologies=tuple(item.technologies or []))
            for item in sorted(resume.projects, key=lambda entry: entry.sort_order)
        ),
    )
