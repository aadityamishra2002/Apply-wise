from app.core.config import Settings
from app.infrastructure.providers.aggregate_jobs import AggregateJobProvider
from app.infrastructure.providers.adzuna_jobs import AdzunaJobProvider
from app.infrastructure.providers.mock_jobs import MockJobProvider
from app.infrastructure.providers.remotive_jobs import RemotiveJobProvider


def create_job_provider(settings: Settings) -> AggregateJobProvider:
    providers = []
    if settings.adzuna_enabled:
        providers.append(
            AdzunaJobProvider(
                app_id=settings.adzuna_app_id,
                app_key=settings.adzuna_app_key,
                country=settings.adzuna_country,
                results_per_page=settings.adzuna_results_per_page,
                timeout_seconds=settings.adzuna_timeout_seconds,
            )
        )
    if settings.remotive_enabled:
        providers.append(
            RemotiveJobProvider(
                results_limit=settings.remotive_results_limit,
                timeout_seconds=settings.remotive_timeout_seconds,
                cache_minutes=settings.remotive_cache_minutes,
            )
        )
    if not providers:
        providers = [MockJobProvider()]
    return AggregateJobProvider(providers)
