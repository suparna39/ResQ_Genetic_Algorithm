"""FastAPI router: POST /predict-priority"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.priority_schema import PriorityRequest, PriorityResponse
from app.services.priority_service import predict_priority

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Predictions"])


@router.post(
    "/predict-priority",
    response_model=PriorityResponse,
    summary="Predict emergency priority class",
    description=(
        "Classifies an emergency request as Low / Medium / High / Critical "
        "based on accident details, weather, road, time, and location features."
    ),
)
async def predict_priority_endpoint(request: PriorityRequest) -> PriorityResponse:
    try:
        result = predict_priority(request.model_dump())
        return PriorityResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Priority prediction failed")
        raise HTTPException(status_code=500, detail=f"Prediction error: {exc}")
