"""
Preprocessing pipelines for all three models.

Each function takes a raw DataFrame, performs feature engineering, and
returns (X: np.ndarray, y: np.ndarray, feature_names: list, encoders: dict).
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler

from app.core.constants import SEVERITY_TO_PRIORITY
from app.core.logging import get_logger
from app.utils.feature_engineering import (
    add_time_features,
    encode_road_condition,
    encode_road_type,
    encode_traffic_density,
    encode_visibility,
    encode_weather,
    label_encode_column,
)
from app.utils.helpers import safe_float

logger = get_logger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Model 1 – Priority
# ──────────────────────────────────────────────────────────────────────────────

PRIORITY_FEATURES: List[str] = [
    "hour", "day_of_week", "month", "is_weekend", "is_rush_hour", "time_period",
    "weather_code", "road_type_code", "road_condition_code", "lighting_code",
    "traffic_control_code", "vehicle_type_code", "location_type_code",
    "num_vehicles", "num_casualties", "num_fatalities",
    "speed_limit", "driver_age", "driver_gender_code",
    "license_status_code", "alcohol_involvement_code",
    "state_code", "city_code",
]


def preprocess_priority(
    df: pd.DataFrame,
    encoders: Dict[str, Any] | None = None,
    scaler: StandardScaler | None = None,
    fit: bool = True,
) -> Tuple[np.ndarray, np.ndarray, List[str], Dict[str, Any], StandardScaler]:
    """
    Preprocess the priority dataset.

    Returns (X, y, feature_names, encoders, scaler).
    When fit=True the encoders/scaler are fitted; otherwise they are applied only.
    """
    df = df.copy()
    if encoders is None:
        encoders = {}

    # ---- pre-convert month and day-of-week strings → int BEFORE add_time_features ----
    month_map = {
        "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
        "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
    }
    if "month" in df.columns and pd.api.types.is_string_dtype(df["month"]):
        df["month"] = df["month"].map(month_map).fillna(1).astype(int)

    dow_map = {
        "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
        "Friday": 4, "Saturday": 5, "Sunday": 6,
    }
    if "day_of_week" in df.columns and pd.api.types.is_string_dtype(df["day_of_week"]):
        df["day_of_week"] = df["day_of_week"].map(dow_map).fillna(0).astype(int)

    # ---- time ----
    df = add_time_features(df, time_col="time_of_day", date_col=None, hour_col=None)

    # Ensure month/day_of_week are set (add_time_features may skip them if already present)
    if "month" not in df.columns:
        df["month"] = 1
    if "day_of_week" not in df.columns:
        df["day_of_week"] = 0

    # Overwrite is_weekend now that day_of_week is guaranteed numeric
    df["is_weekend"] = df["day_of_week"].apply(lambda d: 1 if int(d) >= 5 else 0)

    # ---- weather / road ----
    df["weather_code"] = df.get("weather_conditions", pd.Series(["clear"] * len(df))).apply(encode_weather)
    df["road_type_code"] = df.get("road_type", pd.Series(["urban road"] * len(df))).apply(encode_road_type)
    df["road_condition_code"] = df.get("road_condition", pd.Series(["dry"] * len(df))).apply(encode_road_condition)

    # Lighting
    lighting_map = {"daylight": 0, "dawn": 1, "dusk": 1, "dark": 2}
    df["lighting_code"] = df.get("lighting_conditions", pd.Series(["daylight"] * len(df))).apply(
        lambda v: lighting_map.get(str(v).lower().strip(), 1)
    )

    # Traffic control
    tc_map = {"none": 0, "signs": 1, "signals": 2, "police checkpost": 3}
    df["traffic_control_code"] = df.get("traffic_control_presence", pd.Series(["none"] * len(df))).apply(
        lambda v: tc_map.get(str(v).lower().strip(), 0)
    )

    # ---- categorical label encoders ----
    cat_cols = {
        "vehicle_type_code": "vehicle_type_involved",
        "location_type_code": "accident_location_details",
        "state_code": "state_name",
        "city_code": "city_name",
    }
    for enc_key, col in cat_cols.items():
        if col in df.columns:
            if fit:
                encoded, mapping = label_encode_column(df[col])
                encoders[enc_key] = mapping
            else:
                mapping = encoders.get(enc_key, {})
                encoded = df[col].map(mapping).fillna(-1).astype(int)
            df[enc_key] = encoded
        else:
            df[enc_key] = 0

    # ---- binary flags ----
    df["driver_gender_code"] = df.get("driver_gender", pd.Series(["Male"] * len(df))).apply(
        lambda v: 1 if str(v).lower().strip() == "female" else 0
    )
    license_map = {"valid": 1, "expired": -1, "none": 0}
    df["license_status_code"] = df.get("driver_license_status", pd.Series(["none"] * len(df))).apply(
        lambda v: license_map.get(str(v).lower().strip(), 0)
    )
    df["alcohol_involvement_code"] = df.get("alcohol_involvement", pd.Series(["no"] * len(df))).apply(
        lambda v: 1 if str(v).lower().strip() == "yes" else 0
    )

    # ---- numeric ----
    df["num_vehicles"] = df.get("number_of_vehicles_involved", pd.Series([1] * len(df))).apply(safe_float)
    df["num_casualties"] = df.get("number_of_casualties", pd.Series([0] * len(df))).apply(safe_float)
    df["num_fatalities"] = df.get("number_of_fatalities", pd.Series([0] * len(df))).apply(safe_float)
    df["speed_limit"] = df.get("speed_limit_km_h", pd.Series([50] * len(df))).apply(safe_float)
    df["driver_age"] = df.get("driver_age", pd.Series([35] * len(df))).apply(safe_float)

    # ---- target ----
    if "accident_severity" in df.columns:
        df["target"] = df["accident_severity"].map(SEVERITY_TO_PRIORITY).fillna("Medium")
    else:
        df["target"] = "Medium"

    # ---- label-encode target ----
    if fit:
        le = LabelEncoder()
        y = le.fit_transform(df["target"])
        encoders["target_le"] = le
    else:
        le = encoders.get("target_le", LabelEncoder())
        y = le.transform(df["target"])

    # ---- assemble X ----
    available = [f for f in PRIORITY_FEATURES if f in df.columns]
    X_df = df[available].fillna(0)

    if fit:
        scaler = StandardScaler()
        X = scaler.fit_transform(X_df.astype(float))
    else:
        X = scaler.transform(X_df.astype(float))

    logger.info("Priority preprocessing done: X=%s y=%s classes=%s",
                X.shape, y.shape, le.classes_)
    return X, y, available, encoders, scaler


# ──────────────────────────────────────────────────────────────────────────────
# Model 2 – Hotspot
# ──────────────────────────────────────────────────────────────────────────────

HOTSPOT_FEATURES: List[str] = [
    "hour", "day_of_week", "month", "is_weekend", "is_rush_hour", "time_period",
    "weather_code", "road_type_code", "visibility_code", "traffic_density_code",
    "traffic_signal", "lanes", "temperature", "vehicles_involved", "casualties",
    "is_peak_hour", "festival_code", "cause_code",
    "latitude", "longitude",
]


def preprocess_hotspot(
    df: pd.DataFrame,
    encoders: Dict[str, Any] | None = None,
    scaler: StandardScaler | None = None,
    fit: bool = True,
) -> Tuple[np.ndarray, np.ndarray, List[str], Dict[str, Any], StandardScaler]:
    """
    Preprocess the hotspot dataset.

    Target: risk_score (continuous 0-1) — treated as regression.
    """
    df = df.copy()
    if encoders is None:
        encoders = {}

    # ---- time ----
    df = add_time_features(df, time_col=None, date_col="date", hour_col="hour")

    # ---- categorical ----
    df["weather_code"] = df.get("weather", pd.Series(["clear"] * len(df))).apply(encode_weather)
    df["road_type_code"] = df.get("road_type", pd.Series(["urban"] * len(df))).apply(encode_road_type)
    df["visibility_code"] = df.get("visibility", pd.Series(["high"] * len(df))).apply(encode_visibility)
    df["traffic_density_code"] = df.get("traffic_density", pd.Series(["low"] * len(df))).apply(encode_traffic_density)

    for enc_key, col in [("cause_code", "cause"), ("festival_code", "festival")]:
        if col in df.columns:
            if fit:
                encoded, mapping = label_encode_column(df[col])
                encoders[enc_key] = mapping
            else:
                mapping = encoders.get(enc_key, {})
                encoded = df[col].map(mapping).fillna(-1).astype(int)
            df[enc_key] = encoded
        else:
            df[enc_key] = 0

    # ---- numeric ----
    df["lanes"] = df.get("lanes", pd.Series([2] * len(df))).apply(safe_float)
    df["temperature"] = df.get("temperature", pd.Series([25] * len(df))).apply(safe_float)
    df["vehicles_involved"] = df.get("vehicles_involved", pd.Series([1] * len(df))).apply(safe_float)
    df["casualties"] = df.get("casualties", pd.Series([0] * len(df))).apply(safe_float)
    df["traffic_signal"] = df.get("traffic_signal", pd.Series([0] * len(df))).apply(safe_float)
    df["is_peak_hour"] = df.get("is_peak_hour", pd.Series([0] * len(df))).apply(safe_float)
    df["latitude"] = df.get("latitude", pd.Series([20.0] * len(df))).apply(safe_float)
    df["longitude"] = df.get("longitude", pd.Series([77.0] * len(df))).apply(safe_float)

    # ---- target ----
    y = df["risk_score"].apply(safe_float).values if "risk_score" in df.columns else np.zeros(len(df))

    # ---- assemble X ----
    available = [f for f in HOTSPOT_FEATURES if f in df.columns]
    X_df = df[available].fillna(0)

    if fit:
        scaler = StandardScaler()
        X = scaler.fit_transform(X_df.astype(float))
    else:
        X = scaler.transform(X_df.astype(float))

    logger.info("Hotspot preprocessing done: X=%s y=%s", X.shape, y.shape)
    return X, y, available, encoders, scaler


# ──────────────────────────────────────────────────────────────────────────────
# Model 3 – Traffic
# ──────────────────────────────────────────────────────────────────────────────

TRAFFIC_FEATURES: List[str] = [
    "hour", "day_of_week", "is_weekend", "is_rush_hour",
    "road_type_code", "monthly_avg_congestion",
]


def preprocess_traffic(
    df: pd.DataFrame,
    encoders: Dict[str, Any] | None = None,
    scaler: StandardScaler | None = None,
    fit: bool = True,
) -> Tuple[np.ndarray, np.ndarray, List[str], Dict[str, Any], StandardScaler]:
    """
    Preprocess the traffic dataset.

    Target: congestion_pct (0–100 continuous).
    """
    df = df.copy()
    if encoders is None:
        encoders = {}

    # These columns should already exist from the data loader
    required_numeric = ["hour", "day_of_week", "is_weekend", "is_rush_hour",
                        "road_type_code", "monthly_avg_congestion", "congestion_pct"]
    for col in required_numeric:
        if col not in df.columns:
            df[col] = 0.0

    y = df["congestion_pct"].apply(safe_float).values

    available = [f for f in TRAFFIC_FEATURES if f in df.columns]
    X_df = df[available].fillna(0)

    if fit:
        scaler = StandardScaler()
        X = scaler.fit_transform(X_df.astype(float))
    else:
        X = scaler.transform(X_df.astype(float))

    logger.info("Traffic preprocessing done: X=%s y=%s", X.shape, y.shape)
    return X, y, available, encoders, scaler
