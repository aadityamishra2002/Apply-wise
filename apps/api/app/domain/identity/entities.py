from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True)
class UserRecord:
    id: UUID
    email: str
    password_hash: str
    status: str
    role: str
    created_at: datetime


@dataclass(frozen=True)
class RefreshTokenRecord:
    id: UUID
    user_id: UUID
    token_hash: str
    token_family_id: UUID
    expires_at: datetime
    revoked_at: datetime | None
