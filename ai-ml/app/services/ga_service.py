"""GA orchestration service — wraps the GA engine for the FastAPI route."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.core.config import (
    GA_CROSSOVER_RATE,
    GA_MAX_GENERATIONS,
    GA_MUTATION_RATE,
    GA_POPULATION_SIZE,
)
from app.core.logging import get_logger
from app.ga.genetic_algorithm import run_ga

logger = get_logger(__name__)


def optimize_ambulance(
    patient_lat: float,
    patient_lon: float,
    priority_class: str,
    hotspot_risk: float,
    congestion_multiplier: float,
    ambulances: List[Dict[str, Any]],
    population_size: int = GA_POPULATION_SIZE,
    max_generations: int = GA_MAX_GENERATIONS,
) -> Dict[str, Any]:
    """
    Orchestrate ambulance allocation via the GA engine.

    Validates inputs, calls the GA, and returns a structured result ready
    for the FastAPI response model.
    """
    if not ambulances:
        raise ValueError("Ambulance fleet cannot be empty.")

    if not (-90 <= patient_lat <= 90 and -180 <= patient_lon <= 180):
        raise ValueError(f"Invalid patient coordinates: ({patient_lat}, {patient_lon})")

    congestion_multiplier = max(1.0, float(congestion_multiplier))
    hotspot_risk = max(0.0, min(1.0, float(hotspot_risk)))

    logger.info(
        "GA optimisation: %d ambulances, priority=%s, risk=%.2f, traffic_mult=%.2f",
        len(ambulances), priority_class, hotspot_risk, congestion_multiplier,
    )

    result = run_ga(
        patient_lat=patient_lat,
        patient_lon=patient_lon,
        priority_class=priority_class,
        hotspot_risk=hotspot_risk,
        congestion_multiplier=congestion_multiplier,
        ambulances=ambulances,
        population_size=population_size,
        max_generations=max_generations,
        mutation_rate=GA_MUTATION_RATE,
        crossover_rate=GA_CROSSOVER_RATE,
    )

    return result
