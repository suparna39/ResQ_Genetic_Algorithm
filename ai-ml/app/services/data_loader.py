"""
Data loader for all dataset sources used by the AI Ambulance service.

Handles:
- CSV files (priority, hotspot models)
- JSON / nested-JSON traffic metrics
- CSV traffic weekday stats
- GeoJSON boundary files (metadata only)

Produces clean, normalised pandas DataFrames ready for preprocessing.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

from app.core.config import (
    HOTSPOT_CSV,
    PRIORITY_CSV,
    TRAFFIC_DATASET_DIR,
)
from app.core.logging import get_logger
from app.utils.feature_engineering import normalize_column_names, fill_missing
from app.utils.helpers import extract_numeric, percent_to_float

logger = get_logger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Priority dataset (Model 1)
# ──────────────────────────────────────────────────────────────────────────────

def load_priority_data() -> pd.DataFrame:
    """
    Load the Emergency Priority Prediction CSV.

    Source columns include: State Name, City Name, Year, Month, Day of Week,
    Time of Day, Accident Severity, Number of Vehicles Involved,
    Vehicle Type Involved, Number of Casualties, Number of Fatalities,
    Weather Conditions, Road Type, Road Condition, Lighting Conditions,
    Traffic Control Presence, Speed Limit (km/h), Driver Age, Driver Gender,
    Driver License Status, Alcohol Involvement, Accident Location Details.

    Returns
    -------
    pd.DataFrame
        Normalised column names, NaN-filled dataframe.
    """
    logger.info("Loading priority dataset from %s", PRIORITY_CSV)
    df = pd.read_csv(PRIORITY_CSV, low_memory=False)
    df = normalize_column_names(df)
    df = fill_missing(df)
    logger.info("Priority dataset loaded: %d rows, %d columns", *df.shape)
    return df


# ──────────────────────────────────────────────────────────────────────────────
# Hotspot dataset (Model 2)
# ──────────────────────────────────────────────────────────────────────────────

def load_hotspot_data() -> pd.DataFrame:
    """
    Load the Emergency Hotspot Prediction CSV.

    Source columns include: accident_id, city, state, latitude, longitude,
    date, time, hour, day_of_week, is_weekend, road_type, lanes,
    traffic_signal, weather, visibility, temperature, traffic_density,
    cause, accident_severity, vehicles_involved, casualties,
    is_peak_hour, festival, risk_score.

    Returns
    -------
    pd.DataFrame
        Normalised column names, NaN-filled dataframe.
    """
    logger.info("Loading hotspot dataset from %s", HOTSPOT_CSV)
    df = pd.read_csv(HOTSPOT_CSV, low_memory=False)
    df = normalize_column_names(df)
    df = fill_missing(df)
    logger.info("Hotspot dataset loaded: %d rows, %d columns", *df.shape)
    return df


# ──────────────────────────────────────────────────────────────────────────────
# Traffic dataset (Model 3) helpers
# ──────────────────────────────────────────────────────────────────────────────

def _parse_congestion_csv(path: Path) -> pd.DataFrame:
    """
    Parse a weekday congestion CSV like:
        Time, Sunday, Monday, ..., Saturday
        08:00 AM, 0%, 11%, ...
    Returns long-format rows: [time_slot, day_name, congestion_pct]
    """
    df = pd.read_csv(path)
    df = df.dropna(how="all")
    records = []
    days = [c for c in df.columns if c.strip().lower() != "time"]
    for _, row in df.iterrows():
        time_slot = str(row.iloc[0]).strip()
        for day in days:
            val = str(row[day]).strip()
            records.append({
                "time_slot": time_slot,
                "day_name": day,
                "congestion_pct": percent_to_float(val) * 100,
            })
    return pd.DataFrame(records)


def _parse_speed_csv(path: Path) -> pd.DataFrame:
    """
    Parse a weekday speed CSV like:
        Time, Sunday, ..., Saturday
        08:00 AM, 28 km/h, ...
    Returns long-format rows: [time_slot, day_name, speed_kmh]
    """
    df = pd.read_csv(path)
    df = df.dropna(how="all")
    records = []
    days = [c for c in df.columns if c.strip().lower() != "time"]
    for _, row in df.iterrows():
        time_slot = str(row.iloc[0]).strip()
        for day in days:
            val = str(row[day]).strip()
            records.append({
                "time_slot": time_slot,
                "day_name": day,
                "speed_kmh": extract_numeric(val),
            })
    return pd.DataFrame(records)


def _parse_time_csv(path: Path) -> pd.DataFrame:
    """
    Parse a weekday travel-time CSV.
    Returns long-format rows: [time_slot, day_name, travel_time_min]
    """
    df = pd.read_csv(path)
    df = df.dropna(how="all")
    records = []
    days = [c for c in df.columns if c.strip().lower() != "time"]
    for _, row in df.iterrows():
        time_slot = str(row.iloc[0]).strip()
        for day in days:
            raw = str(row[day]).strip()
            # e.g. "23 min 24 s" → 23.4 minutes
            mins_match = re.search(r"(\d+)\s*min", raw)
            secs_match = re.search(r"(\d+)\s*s", raw)
            mins = int(mins_match.group(1)) if mins_match else extract_numeric(raw)
            secs = int(secs_match.group(1)) if secs_match else 0
            records.append({
                "time_slot": time_slot,
                "day_name": day,
                "travel_time_min": mins + secs / 60.0,
            })
    return pd.DataFrame(records)


def _time_slot_to_hour(time_slot: str) -> int:
    """Convert '08:00 AM' / '14:00' → 24-h integer hour."""
    ts = time_slot.strip().upper()
    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)?", ts)
    if not match:
        return 0
    h, m, ampm = int(match.group(1)), int(match.group(2)), match.group(3) or ""
    if ampm == "PM" and h != 12:
        h += 12
    if ampm == "AM" and h == 12:
        h = 0
    return h


DAY_TO_NUM = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
    "Friday": 4, "Saturday": 5, "Sunday": 6,
}


def load_traffic_data() -> pd.DataFrame:
    """
    Build a unified traffic DataFrame from the Delhi traffic dataset folder.

    Merges weekday congestion, speed, and travel-time CSVs into a single
    wide table with features suitable for training Model 3.

    The source is New Delhi data but the *feature schema* is city-agnostic:
    hour, day_of_week, is_weekend, congestion_pct, speed_kmh,
    travel_time_min, road_type (city / urban).

    Returns
    -------
    pd.DataFrame
    """
    weekday_dir = TRAFFIC_DATASET_DIR / "weekday_stats"
    global_dir = TRAFFIC_DATASET_DIR / "global_metrics"

    frames: List[pd.DataFrame] = []

    # --- weekday stats ---
    for road_type in ("city", "urban"):
        cong_path = weekday_dir / f"2024_week_day_congestion_{road_type}.csv"
        speed_path = weekday_dir / f"2024_week_day_speed_{road_type}.csv"
        time_path = weekday_dir / f"2024_week_day_time_{road_type}.csv"

        if not (cong_path.exists() and speed_path.exists()):
            continue

        df_cong = _parse_congestion_csv(cong_path)
        df_speed = _parse_speed_csv(speed_path)

        merged = df_cong.merge(df_speed, on=["time_slot", "day_name"], how="inner")

        if time_path.exists():
            df_time = _parse_time_csv(time_path)
            merged = merged.merge(df_time, on=["time_slot", "day_name"], how="left")
        else:
            merged["travel_time_min"] = 0.0

        merged["road_type"] = road_type
        frames.append(merged)

    if not frames:
        logger.warning("No weekday stats CSVs found; returning empty DataFrame")
        return pd.DataFrame()

    df = pd.concat(frames, ignore_index=True)

    # Derive structured time features
    df["hour"] = df["time_slot"].apply(_time_slot_to_hour)
    df["day_of_week"] = df["day_name"].map(DAY_TO_NUM).fillna(0).astype(int)
    df["is_weekend"] = df["day_of_week"].apply(lambda d: 1 if d >= 5 else 0)
    df["is_rush_hour"] = df.apply(
        lambda r: 1 if (not bool(r["is_weekend"]) and (7 <= r["hour"] <= 10 or 17 <= r["hour"] <= 21)) else 0,
        axis=1,
    )

    # Encode road type
    df["road_type_code"] = df["road_type"].map({"city": 0, "urban": 1}).fillna(0).astype(int)

    # Augment with monthly congestion from global_metrics JSON
    monthly_cong = _load_monthly_congestion(global_dir)
    if monthly_cong:
        month_avg = sum(monthly_cong.values()) / len(monthly_cong)
        df["monthly_avg_congestion"] = month_avg
    else:
        df["monthly_avg_congestion"] = df["congestion_pct"]

    df = fill_missing(df)
    logger.info("Traffic dataset assembled: %d rows, %d columns", *df.shape)
    return df


def _load_monthly_congestion(global_dir: Path) -> Dict[str, float]:
    """Extract per-month congestion from new_delhi_2024_city_traffic.json."""
    result: Dict[str, float] = {}
    for fname in ("new_delhi_2024_city_traffic.json", "new_delhi_2024_urban_traffic.json"):
        fpath = global_dir / fname
        if not fpath.exists():
            continue
        try:
            data = json.loads(fpath.read_text(encoding="utf-8"))
            for entry in data.get("monthly_congestion_level", []):
                month = entry.get("month", "")
                val = entry.get("2024", entry.get("2023", 0))
                result[month] = float(val)
        except Exception as exc:
            logger.warning("Could not parse %s: %s", fname, exc)
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Generic recursive JSON loader (for future dataset expansion)
# ──────────────────────────────────────────────────────────────────────────────

def load_json_file(path: Path) -> Any:
    """Load a JSON or GeoJSON file and return the parsed Python object."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.error("Failed to load JSON %s: %s", path, exc)
        return {}
