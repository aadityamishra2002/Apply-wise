import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_railway_postgres_url_uses_async_driver() -> None:
    settings = Settings(
        _env_file=None,
        database_url="postgresql://user:password@host:5432/jobcopilot",
    )
    assert settings.database_url == "postgresql+asyncpg://user:password@host:5432/jobcopilot"


def test_production_uses_cross_site_secure_cookie_policy() -> None:
    settings = Settings(
        _env_file=None,
        app_env="production",
        app_secret_key="a-secure-production-secret-that-is-long-enough",
        allowed_hosts="healthcheck.railway.app,*.up.railway.app",
        cors_origins="https://applywise.example.com",
    )
    assert settings.effective_refresh_cookie_samesite == "none"
    assert settings.allowed_host_list == ["healthcheck.railway.app", "*.up.railway.app"]


def test_production_rejects_wildcard_hosts() -> None:
    with pytest.raises(ValidationError, match="ALLOWED_HOSTS must be explicit"):
        Settings(
            _env_file=None,
            app_env="production",
            app_secret_key="a-secure-production-secret-that-is-long-enough",
            allowed_hosts="*",
            cors_origins="https://applywise.example.com",
        )
