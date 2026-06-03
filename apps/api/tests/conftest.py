import asyncio
import os
from collections.abc import Iterator

import pytest

os.environ["APP_ENV"] = "test"
os.environ["APP_SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-jwt-signing"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_jobcopilot.db"
os.environ["ADMIN_EMAILS"] = "owner@example.com"
os.environ["REMOTIVE_ENABLED"] = "false"

from app.infrastructure.db.models import Base  # noqa: E402
from app.infrastructure.db.session import engine  # noqa: E402


async def reset_database() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)


@pytest.fixture(autouse=True)
def database() -> Iterator[None]:
    asyncio.run(reset_database())
    yield
