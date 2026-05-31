import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from app.core.config import Settings
from app.core.security import (
    AccessTokenError,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.domain.identity.entities import UserRecord
from app.domain.identity.exceptions import DuplicateIdentityError
from app.domain.identity.repositories import IdentityUnitOfWork


class AuthenticationError(ValueError):
    pass


class EmailAlreadyRegisteredError(ValueError):
    pass


@dataclass(frozen=True)
class AuthTokens:
    access_token: str
    refresh_token: str
    expires_in: int


class IdentityService:
    def __init__(self, uow: IdentityUnitOfWork, settings: Settings) -> None:
        self._uow = uow
        self._settings = settings

    async def register(self, email: str, password: str) -> tuple[UserRecord, AuthTokens]:
        normalized_email = email.strip().lower()
        if await self._uow.users.get_by_email(normalized_email):
            raise EmailAlreadyRegisteredError("Email is already registered.")
        try:
            user = await self._uow.users.create(
                normalized_email,
                await asyncio.to_thread(hash_password, password),
            )
        except DuplicateIdentityError as error:
            raise EmailAlreadyRegisteredError(str(error)) from error
        tokens = await self._issue_tokens(user.id, uuid4())
        await self._uow.commit()
        return user, tokens

    async def login(self, email: str, password: str) -> tuple[UserRecord, AuthTokens]:
        user = await self._uow.users.get_by_email(email.strip().lower())
        if not user or not await asyncio.to_thread(verify_password, password, user.password_hash):
            raise AuthenticationError("Invalid email or password.")
        if user.status != "active":
            raise AuthenticationError("User account is not active.")
        tokens = await self._issue_tokens(user.id, uuid4())
        await self._uow.commit()
        return user, tokens

    async def refresh(self, refresh_token: str) -> AuthTokens:
        now = datetime.now(timezone.utc)
        stored_token = await self._uow.refresh_tokens.get_by_hash(
            hash_refresh_token(refresh_token)
        )
        if not stored_token:
            raise AuthenticationError("Invalid refresh token.")
        if stored_token.revoked_at:
            await self._uow.refresh_tokens.revoke_family(stored_token.token_family_id, now)
            await self._uow.commit()
            raise AuthenticationError("Refresh token reuse detected.")
        if is_expired(stored_token.expires_at, now):
            await self._uow.refresh_tokens.revoke(stored_token.id, now)
            await self._uow.commit()
            raise AuthenticationError("Refresh token has expired.")
        await self._uow.refresh_tokens.revoke(stored_token.id, now)
        tokens = await self._issue_tokens(stored_token.user_id, stored_token.token_family_id)
        await self._uow.commit()
        return tokens

    async def logout(self, refresh_token: str) -> None:
        stored_token = await self._uow.refresh_tokens.get_by_hash(
            hash_refresh_token(refresh_token)
        )
        if stored_token and not stored_token.revoked_at:
            await self._uow.refresh_tokens.revoke(stored_token.id, datetime.now(timezone.utc))
            await self._uow.commit()

    async def authenticate_access_token(self, access_token: str) -> UserRecord:
        try:
            user_id = decode_access_token(access_token, self._settings)
        except AccessTokenError as error:
            raise AuthenticationError(str(error)) from error
        user = await self._uow.users.get_by_id(user_id)
        if not user or user.status != "active":
            raise AuthenticationError("User account is unavailable.")
        return user

    async def _issue_tokens(self, user_id: UUID, token_family_id: UUID) -> AuthTokens:
        refresh_token = create_refresh_token()
        await self._uow.refresh_tokens.create(
            user_id=user_id,
            token_hash=hash_refresh_token(refresh_token),
            token_family_id=token_family_id,
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=self._settings.refresh_token_expire_days),
        )
        return AuthTokens(
            access_token=create_access_token(user_id, self._settings),
            refresh_token=refresh_token,
            expires_in=self._settings.access_token_expire_minutes * 60,
        )


def is_expired(expires_at: datetime, now: datetime) -> bool:
    if expires_at.tzinfo is None:
        return expires_at <= now.replace(tzinfo=None)
    return expires_at <= now
