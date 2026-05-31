from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Job Application Copilot"
    app_env: str = "development"
    app_secret_key: str = "local-development-only"
    database_url: str = "postgresql+asyncpg://jobcopilot:jobcopilot@localhost:5432/jobcopilot"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: list[str] = ["http://localhost:3000"]
    matching_skills_weight: float = 0.6
    matching_keywords_weight: float = 0.25
    matching_experience_weight: float = 0.15

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()

