"""
FastAPI application entry point for the AI Ambulance Allocation Service.

Loads ML models on startup, registers all routers, and configures CORS,
logging, and OpenAPI documentation.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import (
    CORS_ORIGINS,
    ENVIRONMENT,
    SERVICE_NAME,
    SERVICE_VERSION,
)
from app.core.logging import setup_logging, get_logger
from app.routes import health, predict_priority, predict_hotspot, predict_traffic, optimize_ambulance
from app.services.model_loader import load_all_models

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML model artifacts on startup."""
    logger.info("Starting %s v%s (%s)", SERVICE_NAME, SERVICE_VERSION, ENVIRONMENT)
    status = load_all_models()
    for model_name, loaded in status.items():
        emoji = "✅" if loaded else "⚠️"
        logger.info("  %s %s model: %s", emoji, model_name, "LOADED" if loaded else "NOT FOUND — run training")
    yield
    logger.info("%s shutting down.", SERVICE_NAME)


app = FastAPI(
    title=SERVICE_NAME,
    version=SERVICE_VERSION,
    description=(
        "End-to-end AI/ML microservice for emergency ambulance allocation. "
        "Provides emergency priority prediction, hotspot risk estimation, "
        "traffic congestion forecasting, and Genetic Algorithm-based "
        "ambulance optimisation."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(predict_priority.router)
app.include_router(predict_hotspot.router)
app.include_router(predict_traffic.router)
app.include_router(optimize_ambulance.router)


@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "docs": "/docs",
        "health": "/health",
    }
