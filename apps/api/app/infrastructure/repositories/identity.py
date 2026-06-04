from datetime import datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.identity.entities import PasswordResetTokenRecord, RefreshTokenRecord, UserRecord
from app.domain.identity.exceptions import DuplicateIdentityError
from app.infrastructure.db.models import PasswordResetToken, RefreshToken, User


def to_user_record(user: User) -> UserRecord:
    return UserRecord(
        id=user.id,
        email=user.email,
        password_hash=user.password_hash,
        status=user.status,
        role=user.role,
        created_at=user.created_at,
    )


def to_refresh_token_record(token: RefreshToken) -> RefreshTokenRecord:
    return RefreshTokenRecord(
        id=token.id,
        user_id=token.user_id,
        token_hash=token.token_hash,
        token_family_id=token.token_family_id,
        expires_at=token.expires_at,
        revoked_at=token.revoked_at,
    )


def to_password_reset_token_record(token: PasswordResetToken) -> PasswordResetTokenRecord:
    return PasswordResetTokenRecord(
        id=token.id,
        user_id=token.user_id,
        token_hash=token.token_hash,
        expires_at=token.expires_at,
        used_at=token.used_at,
    )


class SqlAlchemyUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, email: str, password_hash: str, role: str) -> UserRecord:
        user = User(email=email, password_hash=password_hash, role=role)
        self._session.add(user)
        try:
            await self._session.flush()
        except IntegrityError as error:
            await self._session.rollback()
            raise DuplicateIdentityError("Email is already registered.") from error
        return to_user_record(user)

    async def get_by_email(self, email: str) -> UserRecord | None:
        user = await self._session.scalar(select(User).where(User.email == email))
        return to_user_record(user) if user else None

    async def get_by_id(self, user_id: UUID) -> UserRecord | None:
        user = await self._session.get(User, user_id)
        return to_user_record(user) if user else None

    async def update_role(self, user_id: UUID, role: str) -> None:
        await self._session.execute(update(User).where(User.id == user_id).values(role=role))

    async def update_password(self, user_id: UUID, password_hash: str) -> None:
        await self._session.execute(update(User).where(User.id == user_id).values(password_hash=password_hash))


class SqlAlchemyRefreshTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        user_id: UUID,
        token_hash: str,
        token_family_id: UUID,
        expires_at: datetime,
    ) -> RefreshTokenRecord:
        token = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            token_family_id=token_family_id,
            expires_at=expires_at,
        )
        self._session.add(token)
        await self._session.flush()
        return to_refresh_token_record(token)

    async def get_by_hash(self, token_hash: str) -> RefreshTokenRecord | None:
        token = await self._session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        return to_refresh_token_record(token) if token else None

    async def revoke(self, token_id: UUID, revoked_at: datetime) -> None:
        await self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.id == token_id)
            .values(revoked_at=revoked_at)
        )

    async def revoke_family(self, token_family_id: UUID, revoked_at: datetime) -> None:
        await self._session.execute(
            update(RefreshToken)
            .where(
                RefreshToken.token_family_id == token_family_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=revoked_at)
        )

    async def revoke_all_for_user(self, user_id: UUID, revoked_at: datetime) -> None:
        await self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=revoked_at)
        )


class SqlAlchemyPasswordResetTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, user_id: UUID, token_hash: str, expires_at: datetime) -> PasswordResetTokenRecord:
        token = PasswordResetToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        self._session.add(token)
        await self._session.flush()
        return to_password_reset_token_record(token)

    async def get_by_hash(self, token_hash: str) -> PasswordResetTokenRecord | None:
        token = await self._session.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash))
        return to_password_reset_token_record(token) if token else None

    async def mark_used(self, token_id: UUID, used_at: datetime) -> None:
        await self._session.execute(update(PasswordResetToken).where(PasswordResetToken.id == token_id).values(used_at=used_at))

    async def revoke_unused_for_user(self, user_id: UUID, used_at: datetime) -> None:
        await self._session.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used_at.is_(None))
            .values(used_at=used_at)
        )


class SqlAlchemyIdentityUnitOfWork:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self.users = SqlAlchemyUserRepository(session)
        self.refresh_tokens = SqlAlchemyRefreshTokenRepository(session)
        self.password_reset_tokens = SqlAlchemyPasswordResetTokenRepository(session)

    async def commit(self) -> None:
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()
