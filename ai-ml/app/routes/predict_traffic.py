"""FastAPI router: POST /predict-traffic"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.traffic_schema import TrafficRequest, TrafficResponse
from app.services.traffic_service import predict_traffic

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Predictions"])


@router.post(
    "/predict-traffic",
    response_model=TrafficResponse,
    summary="Predict traffic congestion score",
    description=(
        "Predicts the traffic congestion percentage and travel-time multiplier "
        "for a given hour, day-of-week, and road type."
    ),
)
async def predict_traffic_endpoint(request: TrafficRequest) -> TrafficResponse:
    try:
        result = predict_traffic(request.model_dump())
        return TrafficResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Traffic prediction failed")
        raise HTTPException(status_code=500, detail=f"Prediction error: {exc}")
