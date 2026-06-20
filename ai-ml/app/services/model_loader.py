"""
Model loader — loads trained artifacts from disk on service start.

Called once during FastAPI startup. After loading, models are held in
module-level singletons that inference services import directly.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import joblib

from app.core.config import (
    ENCODERS_DIR,
    MODELS_DIR,
    SCALERS_DIR,
    HOTSPOT_ENCODER_FILE,
    HOTSPOT_MODEL_FILE,
    HOTSPOT_SCALER_FILE,
    PRIORITY_ENCODER_FILE,
    PRIORITY_MODEL_FILE,
    PRIORITY_SCALER_FILE,
    TRAFFIC_ENCODER_FILE,
    TRAFFIC_MODEL_FILE,
    TRAFFIC_SCALER_FILE,
)
from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Singletons (populated by load_all_models) ──────────────────────────────────

_priority_model: Optional[Any] = None
_priority_encoders: Optional[Dict] = None
_priority_scaler: Optional[Any] = None

_hotspot_model: Optional[Any] = None
_hotspot_encoders: Optional[Dict] = None
_hotspot_scaler: Optional[Any] = None

_traffic_model: Optional[Any] = None
_traffic_encoders: Optional[Dict] = None
_traffic_scaler: Optional[Any] = None


def _load(path, label: str) -> Optional[Any]:
    if not path.exists():
        logger.warning("Artifact not found: %s (%s)", path, label)
        return None
    try:
        obj = joblib.load(path)
        logger.info("Loaded %s from %s", label, path)
        return obj
    except Exception as exc:
        logger.error("Failed to load %s: %s", label, exc)
        return None


def load_all_models() -> Dict[str, bool]:
    """
    Load all three model artifacts.

    Returns a status dict indicating which models loaded successfully.
    """
    global _priority_model, _priority_encoders, _priority_scaler
    global _hotspot_model, _hotspot_encoders, _hotspot_scaler
    global _traffic_model, _traffic_encoders, _traffic_scaler

    _priority_model = _load(MODELS_DIR / PRIORITY_MODEL_FILE, "priority_model")
    _priority_encoders = _load(ENCODERS_DIR / PRIORITY_ENCODER_FILE, "priority_encoders")
    _priority_scaler = _load(SCALERS_DIR / PRIORITY_SCALER_FILE, "priority_scaler")

    _hotspot_model = _load(MODELS_DIR / HOTSPOT_MODEL_FILE, "hotspot_model")
    _hotspot_encoders = _load(ENCODERS_DIR / HOTSPOT_ENCODER_FILE, "hotspot_encoders")
    _hotspot_scaler = _load(SCALERS_DIR / HOTSPOT_SCALER_FILE, "hotspot_scaler")

    _traffic_model = _load(MODELS_DIR / TRAFFIC_MODEL_FILE, "traffic_model")
    _traffic_encoders = _load(ENCODERS_DIR / TRAFFIC_ENCODER_FILE, "traffic_encoders")
    _traffic_scaler = _load(SCALERS_DIR / TRAFFIC_SCALER_FILE, "traffic_scaler")

    return {
        "priority": _priority_model is not None,
        "hotspot": _hotspot_model is not None,
        "traffic": _traffic_model is not None,
    }


# ── Public getters ─────────────────────────────────────────────────────────────

def get_priority_artifacts():
    return _priority_model, _priority_encoders, _priority_scaler


def get_hotspot_artifacts():
    return _hotspot_model, _hotspot_encoders, _hotspot_scaler


def get_traffic_artifacts():
    return _traffic_model, _traffic_encoders, _traffic_scaler


def models_loaded() -> Dict[str, bool]:
    return {
        "priority": _priority_model is not None,
        "hotspot": _hotspot_model is not None,
        "traffic": _traffic_model is not None,
    }
