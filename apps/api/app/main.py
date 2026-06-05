import logging
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.requests import Request

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.rate_limit import InMemoryRateLimiter, is_sensitive_path
from app.presentation.api_v1.router import router

settings = get_settings()
configure_logging(settings)
logger = logging.getLogger("app.http")
rate_limiter = InMemoryRateLimiter(
    window_seconds=settings.rate_limit_window_seconds,
    default_limit=settings.rate_limit_default_requests,
    sensitive_limit=settings.rate_limit_sensitive_requests,
)

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="API for the AI-powered Job Application Copilot.",
    docs_url="/docs" if settings.enable_api_docs else None,
    redoc_url="/redoc" if settings.enable_api_docs else None,
    openapi_url="/openapi.json" if settings.enable_api_docs else None,
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_host_list)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def rate_limit_request(request: Request, call_next):
    if not settings.rate_limit_enabled or settings.app_env == "test" or request.method == "OPTIONS":
        return await call_next(request)

    forwarded_for = request.headers.get("x-forwarded-for", "")
    direct_client = request.client.host if request.client else "unknown"
    client_ip = forwarded_for.split(",", 1)[0].strip() or direct_client
    auth_hint = request.headers.get("authorization", "")[-16:]
    sensitive = is_sensitive_path(request.url.path)
    identity = auth_hint or client_ip
    result = rate_limiter.check(f"{identity}:{request.url.path}", sensitive=sensitive)

    if not result.allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please wait and try again."},
            headers={
                "Retry-After": str(result.retry_after_seconds),
                "X-RateLimit-Limit": str(result.limit),
                "X-RateLimit-Remaining": "0",
            },
        )

    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(result.limit)
    response.headers["X-RateLimit-Remaining"] = str(result.remaining)
    return response


@app.middleware("http")
async def log_request(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid4()))
    started_at = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "request_failed method=%s path=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            (perf_counter() - started_at) * 1000,
            extra={"request_id": request_id},
        )
        raise
    response.headers["x-request-id"] = request_id
    logger.info(
        "request_complete method=%s path=%s status=%s duration_ms=%.2f",
        request.method,
        request.url.path,
        response.status_code,
        (perf_counter() - started_at) * 1000,
        extra={"request_id": request_id},
    )
    return response


app.include_router(router, prefix="/api/v1")
