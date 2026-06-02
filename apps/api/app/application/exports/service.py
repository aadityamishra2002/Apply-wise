from io import BytesIO
import re

import fitz
from docx import Document

from app.infrastructure.db.models import Job, ResumeVersion


class ResumeExportService:
    def build_docx(self, version: ResumeVersion, job: Job) -> bytes:
        content = version.resume_content
        document = Document()
        document.add_heading(f"Tailored Resume - {job.title}", level=0)
        document.add_paragraph(job.company)
        self._add_content(document, content)
        buffer = BytesIO()
        document.save(buffer)
        return buffer.getvalue()

    def build_pdf(self, version: ResumeVersion, job: Job) -> bytes:
        content = version.resume_content
        lines = [f"TAILORED RESUME - {job.title}", job.company, ""]
        summary = content.get("professional_summary")
        if summary:
            lines.extend(["PROFESSIONAL SUMMARY", str(summary), ""])
        lines.extend(["SKILLS", ", ".join(content.get("skills", [])) or "Review source resume", "", "EXPERIENCE"])
        for experience in content.get("experience", []):
            lines.extend(
                [
                    f"{experience.get('title', '')} | {experience.get('company', '')}",
                    str(experience.get("description", "")),
                    "",
                ]
            )
        document = fitz.open()
        page = document.new_page()
        y = 54
        for line in lines:
            wrapped = wrap_text(line)
            for part in wrapped:
                if y > 780:
                    page = document.new_page()
                    y = 54
                page.insert_text((54, y), part, fontsize=10, fontname="helv")
                y += 15
            y += 4
        output = document.tobytes()
        document.close()
        return output

    def _add_content(self, document: Document, content: dict) -> None:
        summary = content.get("professional_summary")
        if summary:
            document.add_heading("Professional Summary", level=1)
            document.add_paragraph(str(summary))
        document.add_heading("Skills", level=1)
        document.add_paragraph(", ".join(content.get("skills", [])) or "Review source resume")
        document.add_heading("Experience", level=1)
        for experience in content.get("experience", []):
            document.add_heading(f"{experience.get('title', '')} | {experience.get('company', '')}", level=2)
            document.add_paragraph(str(experience.get("description", "")))


def wrap_text(value: str, width: int = 92) -> list[str]:
    words = value.split()
    if not words:
        return [""]
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        if len(current) + len(word) + 1 <= width:
            current = f"{current} {word}"
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def download_filename(job: Job, extension: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", f"{job.company}-{job.title}".lower()).strip("-")
    return f"{slug or 'tailored-resume'}.{extension}"
