"""FastAPI router: POST /optimize-ambulance"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.optimization_schema import OptimizationRequest, OptimizationResponse
from app.services.ga_service import optimize_ambulance

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Optimization"])


@router.post(
    "/optimize-ambulance",
    response_model=OptimizationResponse,
    summary="Genetic Algorithm ambulance allocation",
    description=(
        "Runs a Genetic Algorithm to select the optimal ambulance for a patient. "
        "Takes priority class, hotspot risk, and traffic multiplier from the ML models "
        "and returns the best ambulance assignment with ETA, fitness score, and backup options."
    ),
)
async def optimize_ambulance_endpoint(request: OptimizationRequest) -> OptimizationResponse:
    try:
        kwargs: dict = {}
        if request.population_size:
            kwargs["population_size"] = request.population_size
        if request.max_generations:
            kwargs["max_generations"] = request.max_generations

        result = optimize_ambulance(
            patient_lat=request.patient_lat,
            patient_lon=request.patient_lon,
            priority_class=request.priority_class,
            hotspot_risk=request.hotspot_risk,
            congestion_multiplier=request.congestion_multiplier,
            ambulances=[a.model_dump() for a in request.ambulances],
            **kwargs,
        )
        return OptimizationResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Ambulance optimisation failed")
        raise HTTPException(status_code=500, detail=f"Optimisation error: {exc}")
