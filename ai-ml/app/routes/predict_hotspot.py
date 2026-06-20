"""FastAPI router: POST /predict-hotspot"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.hotspot_schema import HotspotRequest, HotspotResponse
from app.services.hotspot_service import predict_hotspot

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Predictions"])


@router.post(
    "/predict-hotspot",
    response_model=HotspotResponse,
    summary="Predict emergency hotspot risk",
    description=(
        "Predicts a continuous risk score (0-1) for a given city location "
        "and time context. Returns a risk category label."
    ),
)
async def predict_hotspot_endpoint(request: HotspotRequest) -> HotspotResponse:
    try:
        result = predict_hotspot(request.model_dump())
        return HotspotResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Hotspot prediction failed")
        raise HTTPException(status_code=500, detail=f"Prediction error: {exc}")
