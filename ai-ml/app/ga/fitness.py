"""
Fitness function for the ambulance allocation GA.

The fitness function combines multiple objectives into a single scalar:
- Minimises: distance, ETA, traffic delay, ambulance overload
- Maximises: priority handling suitability, response speed, coverage balance

A higher fitness score is *better*.
"""

from __future__ import annotations

from typing import Any, Dict, List

from app.core.constants import AMBULANCE_STATUS_AVAILABLE, PRIORITY_WEIGHTS
from app.utils.geo_utils import eta_minutes, haversine_km


# ── Weights (tunable via environment variables in a future version) ─────────────
W_DISTANCE = 0.25       # penalise long distance
W_ETA = 0.30            # penalise long ETA (most important)
W_PRIORITY = 0.20       # reward matching ambulance capability to priority
W_AVAILABILITY = 0.15   # reward available ambulances
W_COVERAGE = 0.10       # reward even fleet distribution


def compute_fitness(
    ambulance: Dict[str, Any],
    patient_lat: float,
    patient_lon: float,
    priority_class: str,
    hotspot_risk: float,
    congestion_multiplier: float,
    all_ambulances: List[Dict[str, Any]],
    ambulance_assignments: Dict[str, int],
) -> float:
    """
    Compute the fitness score for assigning one ambulance to the patient.

    Parameters
    ----------
    ambulance : dict
        Must have: id, latitude, longitude, status, capability_level (1-4).
    patient_lat, patient_lon : float
        Patient GPS coordinates.
    priority_class : str
        One of Low / Medium / High / Critical.
    hotspot_risk : float
        0-1 risk score from the hotspot model.
    congestion_multiplier : float
        Traffic delay multiplier (1.0 = no delay).
    all_ambulances : list[dict]
        Full fleet snapshot (for coverage balance calculation).
    ambulance_assignments : dict
        {ambulance_id: assignment_count} — how many emergencies each unit
        is already serving (for overload penalty).

    Returns
    -------
    float
        Fitness score. Higher is better. Returns -inf for unavailable units.
    """
    # Hard constraint: only consider available ambulances
    if ambulance.get("status", "").lower() != AMBULANCE_STATUS_AVAILABLE:
        return float("-inf")

    amb_lat = float(ambulance.get("latitude", patient_lat))
    amb_lon = float(ambulance.get("longitude", patient_lon))

    dist_km = haversine_km(patient_lat, patient_lon, amb_lat, amb_lon)
    eta = eta_minutes(dist_km, congestion_multiplier=congestion_multiplier)

    priority_weight = PRIORITY_WEIGHTS.get(priority_class, 2)
    cap_level = int(ambulance.get("capability_level", 2))  # 1=basic, 4=advanced

    # ── Distance score (lower is better → invert) ─────────────────────────────
    # Normalise: assume max useful distance = 30 km
    dist_score = max(0.0, 1.0 - dist_km / 30.0)

    # ── ETA score (lower is better → invert) ──────────────────────────────────
    # Normalise: assume max acceptable ETA = 60 min
    eta_score = max(0.0, 1.0 - eta / 60.0)

    # ── Priority match score ───────────────────────────────────────────────────
    # Reward matching high-capability ambulance to critical emergencies
    cap_match = 1.0 - abs(priority_weight - cap_level) / 4.0
    cap_match = max(0.0, cap_match)
    # Bonus if hotspot risk is high (send better-equipped unit)
    priority_score = cap_match * (1.0 + hotspot_risk * 0.5)

    # ── Availability score ─────────────────────────────────────────────────────
    assignments = ambulance_assignments.get(str(ambulance.get("id", "")), 0)
    availability_score = max(0.0, 1.0 - assignments * 0.3)

    # ── Coverage balance score ────────────────────────────────────────────────
    # Penalise clustering — reward units that are far from the main cluster
    if len(all_ambulances) > 1:
        avg_dist_to_others = _avg_distance_to_fleet(ambulance, all_ambulances)
        coverage_score = min(1.0, avg_dist_to_others / 10.0)
    else:
        coverage_score = 1.0

    # ── Weighted sum ──────────────────────────────────────────────────────────
    fitness = (
        W_DISTANCE * dist_score
        + W_ETA * eta_score
        + W_PRIORITY * priority_score
        + W_AVAILABILITY * availability_score
        + W_COVERAGE * coverage_score
    )
    return fitness


def _avg_distance_to_fleet(
    ambulance: Dict[str, Any],
    fleet: List[Dict[str, Any]],
) -> float:
    """Average Haversine distance from one ambulance to all others."""
    lat = float(ambulance.get("latitude", 0))
    lon = float(ambulance.get("longitude", 0))
    distances = [
        haversine_km(lat, lon, float(a.get("latitude", 0)), float(a.get("longitude", 0)))
        for a in fleet
        if str(a.get("id")) != str(ambulance.get("id"))
    ]
    return sum(distances) / len(distances) if distances else 0.0
