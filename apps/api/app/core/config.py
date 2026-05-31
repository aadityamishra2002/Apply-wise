from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Job Application Copilot"
    app_env: str = "development"
    app_secret_key: str = "local-development-only"
    database_url: str = "postgresql+asyncpg://jobcopilot:jobcopilot@localhost:5432/jobcopilot"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    refresh_cookie_name: str = "jobcopilot_refresh"
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "job-application-copilot"
    matching_skills_weight: float = 0.6
    matching_keywords_weight: float = 0.25
    matching_experience_weight: float = 0.15

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def validate_production_secret(self) -> "Settings":
        insecure_secrets = {"change-me-before-production", "local-development-only"}
        if self.app_env == "production" and (
            self.app_secret_key in insecure_secrets or len(self.app_secret_key) < 32
        ):
            raise ValueError("APP_SECRET_KEY must be a secure value in production.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
