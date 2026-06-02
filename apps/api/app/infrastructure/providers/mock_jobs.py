from datetime import date, timedelta
from uuid import NAMESPACE_URL, uuid5

from app.domain.jobs.entities import Job


class MockJobProvider:
    name = "mock"

    def search_jobs(self, query: str = "", location: str = "") -> list[Job]:
        jobs = [
            Job(
                id=uuid5(NAMESPACE_URL, "jobcopilot:mock-001"),
                external_id="mock-001",
                title="Senior Product Engineer",
                company="Linear",
                location="San Francisco, CA",
                work_mode="Remote",
                salary="$175k - $220k",
                description="Build polished SaaS workflows with React, TypeScript, Python, and PostgreSQL.",
                required_skills=frozenset({"react", "typescript", "python", "postgresql"}),
                posted_at=date.today() - timedelta(days=1),
                url="https://example.com/jobs/mock-001",
            ),
            Job(
                id=uuid5(NAMESPACE_URL, "jobcopilot:mock-002"),
                external_id="mock-002",
                title="Full-Stack Engineer, AI Platform",
                company="Notion",
                location="New York, NY",
                work_mode="Hybrid",
                salary="$165k - $205k",
                description="Ship AI-assisted collaboration features using React, TypeScript, Python, FastAPI, and Redis.",
                required_skills=frozenset({"react", "typescript", "python", "fastapi", "redis"}),
                posted_at=date.today() - timedelta(days=2),
                url="https://example.com/jobs/mock-002",
            ),
            Job(
                id=uuid5(NAMESPACE_URL, "jobcopilot:mock-003"),
                external_id="mock-003",
                title="Product Engineer",
                company="Ramp",
                location="Remote, US",
                work_mode="Remote",
                salary="$150k - $190k",
                description="Own customer-facing product surfaces with React, TypeScript, analytics, and SQL.",
                required_skills=frozenset({"react", "typescript", "sql", "analytics"}),
                posted_at=date.today() - timedelta(days=3),
                url="https://example.com/jobs/mock-003",
            ),
            Job(
                id=uuid5(NAMESPACE_URL, "jobcopilot:mock-004"),
                external_id="mock-004",
                title="Backend Engineer",
                company="Vercel",
                location="Remote",
                work_mode="Remote",
                salary="$155k - $210k",
                description="Design platform services with Python, PostgreSQL, Redis, Docker, and Kubernetes.",
                required_skills=frozenset({"python", "postgresql", "redis", "docker", "kubernetes"}),
                posted_at=date.today() - timedelta(days=4),
                url="https://example.com/jobs/mock-004",
            ),
        ]
        normalized_query = query.strip().lower()
        filtered_jobs = jobs if not normalized_query else [
            job
            for job in jobs
            if normalized_query in f"{job.title} {job.company} {job.description}".lower()
        ]
        normalized_location = location.strip().lower()
        if not normalized_location:
            return filtered_jobs
        return [job for job in filtered_jobs if normalized_location in job.location.lower()]
