from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.identity.service import (
    AuthenticationError,
    EmailAlreadyRegisteredError,
    IdentityService,
)
from app.core.config import get_settings
from app.domain.identity.entities import UserRecord
from app.infrastructure.db.session import get_session
from app.infrastructure.repositories.identity import SqlAlchemyIdentityUnitOfWork

router = APIRouter(prefix="/auth", tags=["authentication"])
bearer_scheme = HTTPBearer(auto_error=False)


class CredentialsRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    status: str


class AuthenticationResponse(BaseModel):
    user: UserResponse
    tokens: TokenResponse


def get_identity_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> IdentityService:
    return IdentityService(SqlAlchemyIdentityUnitOfWork(session), get_settings())


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    service: Annotated[IdentityService, Depends(get_identity_service)],
) -> UserRecord:
    if not credentials:
        raise unauthorized("Missing access token.")
    try:
        return await service.authenticate_access_token(credentials.credentials)
    except AuthenticationError as error:
        raise unauthorized(str(error)) from error


@router.post("/register", response_model=AuthenticationResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: CredentialsRequest,
    response: Response,
    service: Annotated[IdentityService, Depends(get_identity_service)],
) -> AuthenticationResponse:
    try:
        user, tokens = await service.register(str(payload.email), payload.password)
    except EmailAlreadyRegisteredError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    set_refresh_cookie(response, tokens.refresh_token)
    return auth_response(user, tokens.access_token, tokens.expires_in)


@router.post("/login", response_model=AuthenticationResponse)
async def login(
    payload: CredentialsRequest,
    response: Response,
    service: Annotated[IdentityService, Depends(get_identity_service)],
) -> AuthenticationResponse:
    try:
        user, tokens = await service.login(str(payload.email), payload.password)
    except AuthenticationError as error:
        raise unauthorized(str(error)) from error
    set_refresh_cookie(response, tokens.refresh_token)
    return auth_response(user, tokens.access_token, tokens.expires_in)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    service: Annotated[IdentityService, Depends(get_identity_service)],
    refresh_token: Annotated[str | None, Cookie(alias=get_settings().refresh_cookie_name)] = None,
) -> TokenResponse:
    if not refresh_token:
        raise unauthorized("Missing refresh token.")
    try:
        tokens = await service.refresh(refresh_token)
    except AuthenticationError as error:
        raise unauthorized(str(error)) from error
    set_refresh_cookie(response, tokens.refresh_token)
    return TokenResponse(
        access_token=tokens.access_token,
        expires_in=tokens.expires_in,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    service: Annotated[IdentityService, Depends(get_identity_service)],
    refresh_token: Annotated[str | None, Cookie(alias=get_settings().refresh_cookie_name)] = None,
) -> None:
    if refresh_token:
        await service.logout(refresh_token)
    delete_refresh_cookie(response)


@router.get("/me", response_model=UserResponse)
async def me(
    user: Annotated[UserRecord, Depends(get_current_user)],
) -> UserResponse:
    return user_response(user)


def auth_response(
    user: UserRecord,
    access_token: str,
    expires_in: int,
) -> AuthenticationResponse:
    return AuthenticationResponse(
        user=user_response(user),
        tokens=TokenResponse(
            access_token=access_token,
            expires_in=expires_in,
        ),
    )


def user_response(user: UserRecord) -> UserResponse:
    return UserResponse(id=str(user.id), email=user.email, status=user.status)


def unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
        path="/api/v1/auth",
    )


def delete_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path="/api/v1/auth",
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
    )
