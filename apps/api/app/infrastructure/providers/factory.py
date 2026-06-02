from app.core.config import Settings
from app.infrastructure.providers.aggregate_jobs import AggregateJobProvider
from app.infrastructure.providers.adzuna_jobs import AdzunaJobProvider
from app.infrastructure.providers.mock_jobs import MockJobProvider


def create_job_provider(settings: Settings) -> AggregateJobProvider:
    if settings.adzuna_enabled:
        providers = [
            AdzunaJobProvider(
                app_id=settings.adzuna_app_id,
                app_key=settings.adzuna_app_key,
                country=settings.adzuna_country,
                results_per_page=settings.adzuna_results_per_page,
                timeout_seconds=settings.adzuna_timeout_seconds,
            )
        ]
    else:
        providers = [MockJobProvider()]
    return AggregateJobProvider(providers)
