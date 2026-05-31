from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.presentation.api_v1.router import router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="API for the AI-powered Job Application Copilot.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api/v1")

