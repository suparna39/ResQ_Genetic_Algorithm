"""Priority prediction service — inference only."""

from __future__ import annotations

from typing import Any, Dict, List

import numpy as np
import pandas as pd

from app.core.constants import PRIORITY_LABELS
from app.core.logging import get_logger
from app.services.model_loader import get_priority_artifacts
from app.services.preprocessing import PRIORITY_FEATURES, preprocess_priority
from app.utils.feature_engineering import (
    encode_road_condition,
    encode_road_type,
    encode_weather,
)
from app.utils.helpers import safe_float, is_rush_hour

logger = get_logger(__name__)


def predict_priority(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run priority inference on a single emergency request.

    Parameters
    ----------
    request_data : dict
        Keys include: emergency_type, weather, road_condition, road_type,
        traffic_level, zone, hour, day_of_week, month, historical_risk,
        num_vehicles, num_casualties, speed_limit, driver_age, state, city,
        is_weekend (optional).

    Returns
    -------
    dict
        priority_class, confidence, label_probabilities, metadata
    """
    model, encoders, scaler = get_priority_artifacts()
    if model is None or scaler is None:
        raise RuntimeError("Priority model not loaded. Run training first.")

    # Build a single-row DataFrame from the request
    row = _build_priority_row(request_data, encoders)
    df = pd.DataFrame([row])

    # Ensure all expected features are present
    for feat in PRIORITY_FEATURES:
        if feat not in df.columns:
            df[feat] = 0

    X = df[PRIORITY_FEATURES].fillna(0).astype(float)
    X_scaled = scaler.transform(X)

    le = encoders.get("target_le")
    proba = None
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(X_scaled)[0]
        pred_idx = int(np.argmax(proba))
        confidence = float(proba[pred_idx])
        pred_label = le.inverse_transform([pred_idx])[0] if le else str(pred_idx)
        label_probs = {
            str(le.inverse_transform([i])[0] if le else i): float(p)
            for i, p in enumerate(proba)
        }
    else:
        pred_raw = model.predict(X_scaled)[0]
        pred_label = le.inverse_transform([pred_raw])[0] if le else str(pred_raw)
        confidence = 1.0
        label_probs = {pred_label: 1.0}

    return {
        "priority_class": pred_label,
        "confidence": confidence,
        "label_probabilities": label_probs,
        "metadata": {
            "model": type(model).__name__,
            "features_used": PRIORITY_FEATURES,
        },
    }


def _build_priority_row(data: Dict[str, Any], encoders: Dict[str, Any]) -> Dict[str, Any]:
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

    weather_str = str(data.get("weather", "clear"))
    road_type_str = str(data.get("road_type", "urban road"))
    road_cond_str = str(data.get("road_condition", "dry"))

    lighting_map = {"daylight": 0, "dawn": 1, "dusk": 1, "dark": 2}
    tc_map = {"none": 0, "signs": 1, "signals": 2, "police checkpost": 3}
    license_map = {"valid": 1, "expired": -1, "none": 0}

    # Encode categorical fields using stored mappings
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
        "weather_code": encode_weather(weather_str),
        "road_type_code": encode_road_type(road_type_str),
        "road_condition_code": encode_road_condition(road_cond_str),
        "lighting_code": lighting_map.get(str(data.get("lighting", "daylight")).lower(), 0),
        "traffic_control_code": tc_map.get(str(data.get("traffic_control", "none")).lower(), 0),
        "vehicle_type_code": _encode_cat("vehicle_type_code", str(data.get("vehicle_type", "Car"))),
        "location_type_code": _encode_cat("location_type_code", str(data.get("location_type", "Straight Road"))),
        "num_vehicles": safe_float(data.get("num_vehicles", 1)),
        "num_casualties": safe_float(data.get("num_casualties", 0)),
        "num_fatalities": safe_float(data.get("num_fatalities", 0)),
        "speed_limit": safe_float(data.get("speed_limit", 50)),
        "driver_age": safe_float(data.get("driver_age", 35)),
        "driver_gender_code": 1 if str(data.get("driver_gender", "Male")).lower() == "female" else 0,
        "license_status_code": license_map.get(str(data.get("license_status", "valid")).lower(), 1),
        "alcohol_involvement_code": 1 if str(data.get("alcohol_involvement", "No")).lower() == "yes" else 0,
        "state_code": _encode_cat("state_code", str(data.get("state", "Unknown"))),
        "city_code": _encode_cat("city_code", str(data.get("city", "Unknown"))),
    }
