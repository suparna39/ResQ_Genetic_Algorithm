"""Utility: general-purpose helper functions."""

from __future__ import annotations

import re
from typing import Any, Dict, List


def safe_int(value: Any, default: int = 0) -> int:
    """Parse value to int with a fallback default."""
    try:
        return int(float(str(value).strip()))
    except (ValueError, TypeError):
        return default


def safe_float(value: Any, default: float = 0.0) -> float:
    """Parse value to float with a fallback default."""
    try:
        return float(str(value).strip())
    except (ValueError, TypeError):
        return default


def extract_numeric(text: str, default: float = 0.0) -> float:
    """Extract the first numeric value from a string like '25 km/h' → 25.0."""
    if not isinstance(text, str):
        return safe_float(text, default)
    match = re.search(r"[-+]?\d*\.?\d+", text)
    return float(match.group()) if match else default


def percent_to_float(text: str) -> float:
    """Convert '43%' → 0.43."""
    cleaned = str(text).replace("%", "").strip()
    return safe_float(cleaned, 0.0) / 100.0


def flatten_dict(d: Dict[str, Any], parent_key: str = "", sep: str = "__") -> Dict[str, Any]:
    """Recursively flatten a nested dictionary."""
    items: List = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def hour_to_period(hour: int) -> str:
    """Map 24-h integer to a human-readable period label."""
    if 5 <= hour < 12:
        return "morning"
    if 12 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 21:
        return "evening"
    return "night"


def is_rush_hour(hour: int, is_weekend: bool = False) -> bool:
    """Return True if the given hour falls within a typical rush hour."""
    if is_weekend:
        return False
    return (7 <= hour <= 10) or (17 <= hour <= 21)
