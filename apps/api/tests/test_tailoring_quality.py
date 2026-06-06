from uuid import uuid4

from app.application.resumes.service import ResumeCertification, ResumeEducation, ResumeExperience, ResumeProfile
from app.application.tailoring.quality import find_unsupported_claims


def test_find_unsupported_claims_flags_new_skills_companies_titles_and_metrics() -> None:
    profile = ResumeProfile(
        id=uuid4(),
        original_filename="resume.docx",
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        extracted_text="Python React Northstar Labs Senior Product Engineer",
        parse_status="review_required",
        detected_sections=("experience", "skills"),
        skills=("Python", "React"),
        experiences=(
            ResumeExperience(
                title="Senior Product Engineer",
                company="Northstar Labs",
                description="Built Python and React systems.",
            ),
        ),
        education=(ResumeEducation(institution="State University", degree="Bachelor of Engineering", year="2021"),),
        certifications=(ResumeCertification(name="AWS Certified Cloud Practitioner", issuer="Amazon Web Services", year="2022"),),
    )

    warnings = find_unsupported_claims(
        {
            "skills": ["Python", "Kubernetes"],
            "experience": [
                {"title": "Principal Engineer", "company": "Acme Corp", "description": "Improved reliability by 45%."}
            ],
        },
        "I built Kubernetes systems and improved revenue by $1m.",
        profile,
    )

    messages = [warning.message for warning in warnings]
    assert any("Kubernetes" in message for message in messages)
    assert any("Acme Corp" in message for message in messages)
    assert any("Principal Engineer" in message for message in messages)
    assert any("45%" in message or "$1m" in message for message in messages)
