"""Hotspot prediction service — inference only."""

from __future__ import annotations

from typing import Any, Dict

import numpy as np
import pandas as pd

from app.core.constants import HOTSPOT_RISK_BINS, HOTSPOT_RISK_LABELS
from app.core.logging import get_logger
from app.services.model_loader import get_hotspot_artifacts
from app.services.preprocessing import HOTSPOT_FEATURES
from app.utils.feature_engineering import (
    encode_road_type,
    encode_traffic_density,
    encode_visibility,
    encode_weather,
)
from app.utils.helpers import safe_float, is_rush_hour

logger = get_logger(__name__)


def predict_hotspot(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Predict hotspot risk score for a given location/time context.

    Parameters
    ----------
    request_data : dict
        Keys: city, zone, latitude, longitude, hour, day_of_week, month,
        is_weekend, weather, road_type, visibility, traffic_density,
        traffic_signal, lanes, temperature, is_peak_hour, festival,
        cause, vehicles_involved, casualties.

    Returns
    -------
    dict
        risk_score (0–1), risk_category, metadata
    """
    model, encoders, scaler = get_hotspot_artifacts()
    if model is None or scaler is None:
        raise RuntimeError("Hotspot model not loaded. Run training first.")

    row = _build_hotspot_row(request_data, encoders)
    df = pd.DataFrame([row])

    for feat in HOTSPOT_FEATURES:
        if feat not in df.columns:
            df[feat] = 0

    X = df[HOTSPOT_FEATURES].fillna(0).astype(float)
    X_scaled = scaler.transform(X)

    risk_score = float(np.clip(model.predict(X_scaled)[0], 0.0, 1.0))
    category = _score_to_category(risk_score)

    return {
        "risk_score": risk_score,
        "risk_category": category,
        "metadata": {
            "model": type(model).__name__,
            "features_used": HOTSPOT_FEATURES,
        },
    }


def _score_to_category(score: float) -> str:
    for i, upper in enumerate(HOTSPOT_RISK_BINS[1:]):
        if score <= upper:
            return HOTSPOT_RISK_LABELS[i]
    return HOTSPOT_RISK_LABELS[-1]


def _build_hotspot_row(data: Dict[str, Any], encoders: Dict[str, Any]) -> Dict[str, Any]:
    hour = int(data.get("hour", 12))
    day_of_week = int(data.get("day_of_week", 0))
    is_weekend = int(data.get("is_weekend", 1 if day_of_week >= 5 else 0))

    def _period(h: int) -> int:
        if 5 <= h < 12:
            return 1
        if 12 <= h < 17:
            return 2
        if 17 <= h < 21:
            return 3
        return 0

    def _encode_cat(enc_key: str, val: str) -> int:
        mapping = encoders.get(enc_key, {})
        return int(mapping.get(val, -1)) if mapping else -1

    return {
        "hour": hour,
        "day_of_week": day_of_week,
        "month": int(data.get("month", 6)),
        "is_weekend": is_weekend,
        "is_rush_hour": int(is_rush_hour(hour, bool(is_weekend))),
        "time_period": _period(hour),
        "weather_code": encode_weather(str(data.get("weather", "clear"))),
        "road_type_code": encode_road_type(str(data.get("road_type", "urban"))),
        "visibility_code": encode_visibility(str(data.get("visibility", "high"))),
        "traffic_density_code": encode_traffic_density(str(data.get("traffic_density", "low"))),
        "traffic_signal": safe_float(data.get("traffic_signal", 0)),
        "lanes": safe_float(data.get("lanes", 2)),
        "temperature": safe_float(data.get("temperature", 25)),
        "vehicles_involved": safe_float(data.get("vehicles_involved", 1)),
        "casualties": safe_float(data.get("casualties", 0)),
        "is_peak_hour": safe_float(data.get("is_peak_hour", 0)),
        "festival_code": _encode_cat("festival_code", str(data.get("festival", "None"))),
        "cause_code": _encode_cat("cause_code", str(data.get("cause", "weather"))),
        "latitude": safe_float(data.get("latitude", 20.0)),
        "longitude": safe_float(data.get("longitude", 77.0)),
    }
