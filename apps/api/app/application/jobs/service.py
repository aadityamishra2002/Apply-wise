from dataclasses import dataclass

from app.domain.jobs.entities import Job, JobMatch


@dataclass(frozen=True)
class MatchingWeights:
    skills: float
    keywords: float
    experience: float

    def __post_init__(self) -> None:
        if round(self.skills + self.keywords + self.experience, 6) != 1:
            raise ValueError("Matching weights must sum to 1.")


class JobMatchingService:
    def __init__(self, weights: MatchingWeights) -> None:
        self._weights = weights

    def rank_jobs(
        self,
        jobs: list[Job],
        profile_skills: set[str],
        profile_keywords: set[str],
    ) -> list[JobMatch]:
        matches = [
            self._score(job, profile_skills, profile_keywords)
            for job in jobs
        ]
        return sorted(matches, key=lambda match: match.match_score, reverse=True)

    def _score(
        self,
        job: Job,
        profile_skills: set[str],
        profile_keywords: set[str],
    ) -> JobMatch:
        normalized_skills = {skill.lower() for skill in profile_skills}
        matching = sorted(job.required_skills & normalized_skills)
        missing = sorted(job.required_skills - normalized_skills)
        skill_ratio = len(matching) / max(len(job.required_skills), 1)
        description = job.description.lower()
        keyword_hits = sum(keyword.lower() in description for keyword in profile_keywords)
        keyword_ratio = keyword_hits / max(len(profile_keywords), 1)
        experience_score = 0.9 if "senior" in job.title.lower() else 1.0
        total = (
            skill_ratio * self._weights.skills
            + keyword_ratio * self._weights.keywords
            + experience_score * self._weights.experience
        )
        return JobMatch(
            job=job,
            match_score=round(total * 100),
            matching_skills=tuple(matching),
            missing_skills=tuple(missing),
            experience_match=round(experience_score * 100),
        )

