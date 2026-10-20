import asyncio
import logging
from contextlib import asynccontextmanager
from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.requests import Request

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.rate_limit import is_sensitive_path, rate_limiter
from app.infrastructure.db.session import engine
from app.presentation.api_v1.router import router
from redis.exceptions import RedisError

settings = get_settings()
configure_logging(settings)
logger = logging.getLogger("app.http")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    worker_task = None
    try:
        if settings.app_env != "test" and settings.rate_limit_enabled:
            try:
                await rate_limiter.ping()
            except RedisError as error:
                raise RuntimeError("Redis must be available for API rate limiting.") from error
        if settings.app_env != "test" and settings.run_in_process_worker:
            from app.worker import work_forever

            worker_task = asyncio.create_task(work_forever(), name="apply-wise-in-process-worker")
        yield
    finally:
        if worker_task:
            worker_task.cancel()
            try:
                await worker_task
            except asyncio.CancelledError:
                pass
        await rate_limiter.close()
        await engine.dispose()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="API for the AI-powered Job Application Copilot.",
    docs_url="/docs" if settings.enable_api_docs else None,
    redoc_url="/redoc" if settings.enable_api_docs else None,
    openapi_url="/openapi.json" if settings.enable_api_docs else None,
    lifespan=lifespan,
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
    if request.url.path.startswith("/api/v1/health"):
        return await call_next(request)

    identity = request.client.host if request.client else "unknown"
    sensitive = is_sensitive_path(request.url.path)
    try:
        result = await rate_limiter.check(f"{identity}:{request.url.path}", sensitive=sensitive)
    except RedisError:
        logger.exception("rate_limit_backend_unavailable")
        return JSONResponse(
            status_code=503,
            content={"detail": "Request protection is temporarily unavailable. Please retry shortly."},
            headers={"Retry-After": "2"},
        )

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
