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


def test_admin_email_list_is_normalized() -> None:
    settings = Settings(_env_file=None, admin_emails=" Owner@Example.com,admin@example.com ")
    assert settings.admin_email_list == ["owner@example.com", "admin@example.com"]


def test_adzuna_is_enabled_only_when_both_credentials_exist() -> None:
    assert not Settings(_env_file=None, adzuna_app_id="id-only").adzuna_enabled
    assert Settings(_env_file=None, adzuna_app_id="id", adzuna_app_key="key").adzuna_enabled


def test_gemini_is_enabled_only_when_api_key_exists() -> None:
    assert not Settings(_env_file=None).gemini_enabled
    assert Settings(_env_file=None, gemini_api_key="key").gemini_enabled


def test_remotive_is_enabled_by_default_and_can_be_disabled(monkeypatch) -> None:
    monkeypatch.delenv("REMOTIVE_ENABLED", raising=False)
    assert Settings(_env_file=None).remotive_enabled
    assert not Settings(_env_file=None, remotive_enabled=False).remotive_enabled
