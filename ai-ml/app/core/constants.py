"""
Domain-level constants for the AI Ambulance Allocation Service.

These values define valid input domains, label mappings, and scoring
constants.  They are intentionally city-agnostic — city identity is
always passed as a runtime parameter.
"""

# ── Priority model ─────────────────────────────────────────────────────────────
PRIORITY_LABELS = ["Low", "Medium", "High", "Critical"]

# Mapping from raw Accident-Severity strings (Model-1 CSV) → priority class
SEVERITY_TO_PRIORITY = {
    "Minor": "Low",
    "Serious": "High",
    "Fatal": "Critical",
    # Some datasets may use different casing
    "minor": "Low",
    "serious": "High",
    "fatal": "Critical",
}

# ── Hotspot model ─────────────────────────────────────────────────────────────
HOTSPOT_RISK_BINS = [0.0, 0.3, 0.5, 0.7, 0.85, 1.0]
HOTSPOT_RISK_LABELS = ["Very Low", "Low", "Medium", "High", "Critical"]

# ── Traffic congestion ────────────────────────────────────────────────────────
# Congestion percent → multiplier used in ETA calculation
CONGESTION_MULTIPLIER_BINS = [0, 10, 25, 40, 60, 100]
CONGESTION_MULTIPLIERS = [1.0, 1.2, 1.5, 2.0, 2.8]

# Rush-hour definitions (24-h clock)
MORNING_RUSH_START = 7
MORNING_RUSH_END = 10
EVENING_RUSH_START = 17
EVENING_RUSH_END = 21

# ── GA ─────────────────────────────────────────────────────────────────────────
# Priority weight for the GA fitness function  (Critical → 4, Low → 1)
PRIORITY_WEIGHTS = {
    "Critical": 4,
    "High": 3,
    "Medium": 2,
    "Low": 1,
}

# Ambulance status encoding
AMBULANCE_STATUS_AVAILABLE = "available"
AMBULANCE_STATUS_BUSY = "busy"
AMBULANCE_STATUS_OFFLINE = "offline"

# ── Geo ────────────────────────────────────────────────────────────────────────
# Earth radius in kilometres (Haversine formula)
EARTH_RADIUS_KM = 6371.0

# Average urban speed (km/h) fallback when traffic model is unavailable
DEFAULT_URBAN_SPEED_KMH = 25.0
