"""
Feature-engineering utilities shared across all three models.

Converts raw DataFrame columns into ML-ready numeric features, handling
missing values and encoding in a consistent, city-agnostic manner.
"""

from __future__ import annotations

import re
from typing import List

import numpy as np
import pandas as pd

from app.utils.helpers import safe_float, extract_numeric, is_rush_hour


# ── Time features ──────────────────────────────────────────────────────────────

def extract_hour(time_str: str) -> int:
    """Parse '14:30', '8:4', etc. → integer hour (0–23)."""
    try:
        parts = str(time_str).strip().split(":")
        return int(parts[0])
    except Exception:
        return 0


def add_time_features(df: pd.DataFrame, time_col: str | None = None,
                      date_col: str | None = None, hour_col: str | None = None) -> pd.DataFrame:
    """
    Enrich a DataFrame with time-based features.

    Adds: hour, day_of_week (0=Mon), month, is_weekend, is_rush_hour, time_period.
    Works from a combined datetime column, separate date + time columns, or an
    existing hour column.
    """
    df = df.copy()

    # ---------- resolve hour ----------
    if hour_col and hour_col in df.columns:
        df["hour"] = df[hour_col].apply(safe_float).astype(int)
    elif time_col and time_col in df.columns:
        df["hour"] = df[time_col].apply(extract_hour)
    elif "hour" not in df.columns:
        df["hour"] = 0

    # ---------- resolve date ----------
    if date_col and date_col in df.columns:
        dt = pd.to_datetime(df[date_col], errors="coerce")
        df["day_of_week"] = dt.dt.dayofweek.fillna(0).astype(int)
        df["month"] = dt.dt.month.fillna(1).astype(int)
    elif "day_of_week" not in df.columns:
        df["day_of_week"] = 0
        df["month"] = 1

    # ---------- derived flags ----------
    if "is_weekend" not in df.columns:
        # Safely coerce day_of_week to int (may still be string here)
        def _is_weekend(d) -> int:
            try:
                return 1 if int(d) >= 5 else 0
            except (ValueError, TypeError):
                # String day names: Monday=0..Sunday=6
                day_map = {
                    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
                    "friday": 4, "saturday": 5, "sunday": 6,
                }
                return 1 if day_map.get(str(d).lower().strip(), 0) >= 5 else 0
        df["is_weekend"] = df["day_of_week"].apply(_is_weekend)

    df["is_rush_hour"] = df.apply(
        lambda r: int(is_rush_hour(int(r["hour"]), bool(r.get("is_weekend", 0)))), axis=1
    )

    # Numeric period (0=night,1=morning,2=afternoon,3=evening)
    def _period(h: int) -> int:
        if 5 <= h < 12:
            return 1
        if 12 <= h < 17:
            return 2
        if 17 <= h < 21:
            return 3
        return 0

    df["time_period"] = df["hour"].apply(_period)
    return df


# ── Weather / road features ────────────────────────────────────────────────────

WEATHER_MAP = {
    "clear": 0, "sunny": 0,
    "hazy": 1, "foggy": 1, "fog": 1,
    "rainy": 2, "rain": 2,
    "stormy": 3,
}

ROAD_COND_MAP = {
    "dry": 0,
    "wet": 1,
    "damaged": 2,
    "under construction": 3,
}

ROAD_TYPE_MAP = {
    "national highway": 0, "highway": 0,
    "state highway": 1,
    "urban road": 2, "urban": 2,
    "village road": 3, "rural": 3,
}

VISIBILITY_MAP = {"high": 0, "medium": 1, "low": 2}
TRAFFIC_DENSITY_MAP = {"low": 0, "medium": 1, "high": 2}


def encode_weather(value: str) -> int:
    return WEATHER_MAP.get(str(value).lower().strip(), 1)


def encode_road_condition(value: str) -> int:
    return ROAD_COND_MAP.get(str(value).lower().strip(), 0)


def encode_road_type(value: str) -> int:
    return ROAD_TYPE_MAP.get(str(value).lower().strip(), 2)


def encode_visibility(value: str) -> int:
    return VISIBILITY_MAP.get(str(value).lower().strip(), 1)


def encode_traffic_density(value: str) -> int:
    return TRAFFIC_DENSITY_MAP.get(str(value).lower().strip(), 1)


# ── Generic column normalisation ───────────────────────────────────────────────

def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """Lowercase, strip, and replace spaces/special chars with underscores."""
    df = df.copy()
    df.columns = [
        re.sub(r"[^a-z0-9]+", "_", c.lower().strip()).strip("_")
        for c in df.columns
    ]
    return df


def fill_missing(df: pd.DataFrame) -> pd.DataFrame:
    """Fill numeric NaN with median and categorical NaN with 'Unknown'."""
    df = df.copy()
    for col in df.columns:
        if df[col].dtype in [np.float64, np.float32, np.int64, np.int32]:
            df[col] = df[col].fillna(df[col].median())
        else:
            df[col] = df[col].fillna("Unknown")
    return df


def label_encode_column(series: pd.Series, mapping: dict | None = None) -> tuple[pd.Series, dict]:
    """
    Encode a categorical Series to integer codes.

    Returns the encoded Series and the label → int mapping dict.
    """
    if mapping is None:
        categories = sorted(series.dropna().unique().tolist())
        mapping = {cat: i for i, cat in enumerate(categories)}
    encoded = series.map(mapping).fillna(-1).astype(int)
    return encoded, mapping
