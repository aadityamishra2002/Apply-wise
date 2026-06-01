from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.domain.identity.entities import RefreshTokenRecord, UserRecord


class UserRepository(Protocol):
    async def create(self, email: str, password_hash: str, role: str) -> UserRecord:
        ...

    async def get_by_email(self, email: str) -> UserRecord | None:
        ...

    async def get_by_id(self, user_id: UUID) -> UserRecord | None:
        ...

    async def update_role(self, user_id: UUID, role: str) -> None:
        ...


class RefreshTokenRepository(Protocol):
    async def create(
        self,
        user_id: UUID,
        token_hash: str,
        token_family_id: UUID,
        expires_at: datetime,
    ) -> RefreshTokenRecord:
        ...

    async def get_by_hash(self, token_hash: str) -> RefreshTokenRecord | None:
        ...

    async def revoke(self, token_id: UUID, revoked_at: datetime) -> None:
        ...

    async def revoke_family(self, token_family_id: UUID, revoked_at: datetime) -> None:
        ...


class IdentityUnitOfWork(Protocol):
    users: UserRepository
    refresh_tokens: RefreshTokenRepository

    async def commit(self) -> None:
        ...

    async def rollback(self) -> None:
        ...
