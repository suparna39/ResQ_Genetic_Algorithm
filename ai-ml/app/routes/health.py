"""FastAPI router: GET /health"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import SERVICE_NAME, SERVICE_VERSION, ENVIRONMENT
from app.services.model_loader import models_loaded

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    models: dict


@router.get("/health", response_model=HealthResponse, summary="Service health check")
async def health_check() -> HealthResponse:
    """
    Returns the current health status of the AI service.

    Checks whether all three ML models are loaded and reports their status.
    """
    loaded = models_loaded()
    all_loaded = all(loaded.values())
    return HealthResponse(
        status="healthy" if all_loaded else "degraded",
        service=SERVICE_NAME,
        version=SERVICE_VERSION,
        environment=ENVIRONMENT,
        models={
            "priority_model": "loaded" if loaded.get("priority") else "not_loaded",
            "hotspot_model": "loaded" if loaded.get("hotspot") else "not_loaded",
            "traffic_model": "loaded" if loaded.get("traffic") else "not_loaded",
        },
    )
