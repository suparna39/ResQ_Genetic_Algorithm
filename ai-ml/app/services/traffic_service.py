"""Traffic estimation service — inference only."""

from __future__ import annotations

from typing import Any, Dict

import numpy as np
import pandas as pd

from app.core.logging import get_logger
from app.services.model_loader import get_traffic_artifacts
from app.services.preprocessing import TRAFFIC_FEATURES
from app.utils.geo_utils import congestion_to_multiplier
from app.utils.helpers import safe_float, is_rush_hour

logger = get_logger(__name__)


def predict_traffic(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Predict traffic congestion score for a given time/location context.

    Parameters
    ----------
    request_data : dict
        Keys: hour, day_of_week, is_weekend, road_type (city|urban),
        month (optional).

    Returns
    -------
    dict
        congestion_pct (0-100), congestion_multiplier, traffic_level, metadata
    """
    model, encoders, scaler = get_traffic_artifacts()
    if model is None or scaler is None:
        raise RuntimeError("Traffic model not loaded. Run training first.")

    row = _build_traffic_row(request_data)
    df = pd.DataFrame([row])

    for feat in TRAFFIC_FEATURES:
        if feat not in df.columns:
            df[feat] = 0

    X = df[TRAFFIC_FEATURES].fillna(0).astype(float)
    X_scaled = scaler.transform(X)

    congestion_pct = float(np.clip(model.predict(X_scaled)[0], 0.0, 100.0))
    multiplier = congestion_to_multiplier(congestion_pct)
    level = _congestion_level(congestion_pct)

    return {
        "congestion_pct": round(congestion_pct, 2),
        "congestion_multiplier": round(multiplier, 3),
        "traffic_level": level,
        "metadata": {
            "model": type(model).__name__,
            "features_used": TRAFFIC_FEATURES,
        },
    }


def _congestion_level(pct: float) -> str:
    if pct < 15:
        return "Free Flow"
    if pct < 30:
        return "Light"
    if pct < 50:
        return "Moderate"
    if pct < 70:
        return "Heavy"
    return "Gridlock"


def _build_traffic_row(data: Dict[str, Any]) -> Dict[str, Any]:
    hour = int(data.get("hour", 12))
    day_of_week = int(data.get("day_of_week", 0))
    is_weekend = int(data.get("is_weekend", 1 if day_of_week >= 5 else 0))
    road_type_str = str(data.get("road_type", "urban")).lower()
    road_type_code = 0 if "city" in road_type_str else 1

    return {
        "hour": hour,
        "day_of_week": day_of_week,
        "is_weekend": is_weekend,
        "is_rush_hour": int(is_rush_hour(hour, bool(is_weekend))),
        "road_type_code": road_type_code,
        "monthly_avg_congestion": safe_float(data.get("monthly_avg_congestion", 33.0)),
    }
