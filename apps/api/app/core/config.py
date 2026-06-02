from functools import lru_cache
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Job Application Copilot"
    app_env: str = "development"
    app_secret_key: str = "local-development-only"
    database_url: str = "postgresql+asyncpg://jobcopilot:jobcopilot@localhost:5432/jobcopilot"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    cors_origin_regex: str | None = None
    allowed_hosts: str = "*"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    refresh_cookie_name: str = "jobcopilot_refresh"
    refresh_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "job-application-copilot"
    enable_api_docs: bool = True
    log_level: str = "INFO"
    log_format: Literal["text", "json"] = "text"
    admin_emails: str = ""
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""
    adzuna_country: str = "in"
    adzuna_results_per_page: int = 20
    adzuna_timeout_seconds: float = 10
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_seconds: float = 20
    matching_skills_weight: float = 0.6
    matching_keywords_weight: float = 0.25
    matching_experience_weight: float = 0.15

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+asyncpg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+asyncpg://", 1)
        return value

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        insecure_secrets = {"change-me-before-production", "local-development-only"}
        if self.app_env == "production" and (
            self.app_secret_key in insecure_secrets or len(self.app_secret_key) < 32
        ):
            raise ValueError("APP_SECRET_KEY must be a secure value in production.")
        if self.app_env == "production" and "*" in self.allowed_host_list:
            raise ValueError("ALLOWED_HOSTS must be explicit in production.")
        if self.app_env == "production" and "*" in self.cors_origin_list:
            raise ValueError("CORS_ORIGINS must be explicit in production.")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return parse_csv(self.cors_origins)

    @property
    def allowed_host_list(self) -> list[str]:
        return parse_csv(self.allowed_hosts)

    @property
    def admin_email_list(self) -> list[str]:
        return [email.lower() for email in parse_csv(self.admin_emails)]

    @property
    def effective_refresh_cookie_samesite(self) -> Literal["lax", "strict", "none"]:
        if self.app_env == "production":
            return "none"
        return self.refresh_cookie_samesite

    @property
    def adzuna_enabled(self) -> bool:
        return bool(self.adzuna_app_id and self.adzuna_app_key)

    @property
    def gemini_enabled(self) -> bool:
        return bool(self.gemini_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()


def parse_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]
