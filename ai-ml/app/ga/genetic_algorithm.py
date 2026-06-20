"""
Genetic Algorithm engine for ambulance allocation optimisation.

Implements from scratch:
- Population initialisation
- Fitness evaluation
- Tournament selection
- Single-point crossover
- Gene-level mutation
- Elitism
- Generation loop
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import (
    GA_CROSSOVER_RATE,
    GA_ELITISM_COUNT,
    GA_MAX_GENERATIONS,
    GA_MUTATION_RATE,
    GA_POPULATION_SIZE,
    RANDOM_SEED,
)
from app.core.constants import AMBULANCE_STATUS_AVAILABLE
from app.core.logging import get_logger
from app.ga.crossover import single_point_crossover
from app.ga.fitness import compute_fitness
from app.ga.mutation import mutate
from app.ga.selection import tournament_select
from app.utils.geo_utils import eta_minutes, haversine_km

logger = get_logger(__name__)


def run_ga(
    patient_lat: float,
    patient_lon: float,
    priority_class: str,
    hotspot_risk: float,
    congestion_multiplier: float,
    ambulances: List[Dict[str, Any]],
    population_size: int = GA_POPULATION_SIZE,
    max_generations: int = GA_MAX_GENERATIONS,
    mutation_rate: float = GA_MUTATION_RATE,
    crossover_rate: float = GA_CROSSOVER_RATE,
    elitism_count: int = GA_ELITISM_COUNT,
    seed: int = RANDOM_SEED,
) -> Dict[str, Any]:
    """
    Run the Genetic Algorithm to select the best ambulance.

    Parameters
    ----------
    patient_lat, patient_lon : float
        Patient GPS coordinates.
    priority_class : str
        Emergency priority (Low/Medium/High/Critical).
    hotspot_risk : float
        0-1 risk score from the hotspot model.
    congestion_multiplier : float
        Traffic delay factor from the traffic model.
    ambulances : list[dict]
        Full fleet. Each entry: id, latitude, longitude, status,
        capability_level (1-4).
    population_size, max_generations, mutation_rate, crossover_rate,
    elitism_count, seed : GA hyper-parameters.

    Returns
    -------
    dict
        best_ambulance_id, best_ambulance, estimated_eta_minutes,
        fitness_score, backup_suggestions, generations_run,
        convergence_generation, ga_metadata.
    """
    random.seed(seed)

    available = [a for a in ambulances if a.get("status", "").lower() == AMBULANCE_STATUS_AVAILABLE]
    if not available:
        return _no_available_result()

    n = len(available)

    # Track how many times each ambulance has already been assigned
    assignment_counts: Dict[str, int] = {str(a.get("id", i)): 0 for i, a in enumerate(available)}

    # ── Initialise population ──────────────────────────────────────────────────
    # Each individual is a chromosome of length 1 (one ambulance index).
    # We extend to a gene vector approach for future multi-assignment support.
    population: List[List[int]] = [
        [random.randint(0, n - 1)] for _ in range(population_size)
    ]

    best_individual: List[int] = population[0]
    best_fitness: float = float("-inf")
    convergence_gen: int = 0
    fitness_history: List[float] = []

    # ── Evolution loop ─────────────────────────────────────────────────────────
    for generation in range(max_generations):
        # Evaluate fitness for every individual
        fitness_scores: List[float] = []
        for individual in population:
            amb_idx = individual[0] % n
            amb = available[amb_idx]
            f = compute_fitness(
                amb,
                patient_lat,
                patient_lon,
                priority_class,
                hotspot_risk,
                congestion_multiplier,
                available,
                assignment_counts,
            )
            fitness_scores.append(f)

        # Track global best
        gen_best_idx = max(range(len(population)), key=lambda i: fitness_scores[i])
        gen_best_fitness = fitness_scores[gen_best_idx]

        if gen_best_fitness > best_fitness:
            best_fitness = gen_best_fitness
            best_individual = list(population[gen_best_idx])
            convergence_gen = generation

        fitness_history.append(gen_best_fitness)

        # Early stopping: if fitness hasn't improved for 15 generations
        if generation > convergence_gen + 15:
            logger.debug("GA early stop at generation %d", generation)
            break

        # ── Build next generation ──────────────────────────────────────────────
        # Elitism: preserve top N individuals
        sorted_indices = sorted(range(len(population)), key=lambda i: fitness_scores[i], reverse=True)
        elite = [list(population[i]) for i in sorted_indices[:elitism_count]]

        new_population: List[List[int]] = elite[:]

        while len(new_population) < population_size:
            p1_idx = tournament_select(population, fitness_scores)
            p2_idx = tournament_select(population, fitness_scores)
            parent_a = population[p1_idx]
            parent_b = population[p2_idx]

            child_a, child_b = single_point_crossover(parent_a, parent_b, crossover_rate)
            child_a = mutate(child_a, n, mutation_rate)
            child_b = mutate(child_b, n, mutation_rate)

            new_population.append(child_a)
            if len(new_population) < population_size:
                new_population.append(child_b)

        population = new_population

    # ── Extract result ─────────────────────────────────────────────────────────
    best_amb_idx = best_individual[0] % n
    best_ambulance = available[best_amb_idx]

    dist = haversine_km(
        patient_lat, patient_lon,
        float(best_ambulance.get("latitude", patient_lat)),
        float(best_ambulance.get("longitude", patient_lon)),
    )
    eta = eta_minutes(dist, congestion_multiplier=congestion_multiplier)

    # ── Backup suggestions (top-3 excluding best) ──────────────────────────────
    fitness_scores_final = []
    for i, amb in enumerate(available):
        f = compute_fitness(
            amb, patient_lat, patient_lon, priority_class, hotspot_risk,
            congestion_multiplier, available, assignment_counts,
        )
        fitness_scores_final.append((i, f, amb))

    fitness_scores_final.sort(key=lambda x: x[1], reverse=True)
    backups = [
        {
            "ambulance_id": str(a.get("id", i)),
            "fitness": round(f, 4),
            "eta_minutes": round(
                eta_minutes(
                    haversine_km(patient_lat, patient_lon,
                                 float(a.get("latitude", patient_lat)),
                                 float(a.get("longitude", patient_lon))),
                    congestion_multiplier=congestion_multiplier,
                ), 2),
        }
        for i, f, a in fitness_scores_final[1:4]
        if str(a.get("id")) != str(best_ambulance.get("id"))
    ]

    return {
        "best_ambulance_id": str(best_ambulance.get("id", best_amb_idx)),
        "best_ambulance": best_ambulance,
        "estimated_eta_minutes": round(eta, 2),
        "fitness_score": round(best_fitness, 4),
        "distance_km": round(dist, 3),
        "backup_suggestions": backups[:2],
        "reason_for_assignment": _build_reason(best_ambulance, priority_class, dist, eta, best_fitness),
        "ga_metadata": {
            "generations_run": convergence_gen + 1,
            "convergence_generation": convergence_gen,
            "population_size": population_size,
            "max_generations": max_generations,
            "final_best_fitness": round(best_fitness, 4),
        },
    }


def _no_available_result() -> Dict[str, Any]:
    return {
        "best_ambulance_id": None,
        "best_ambulance": None,
        "estimated_eta_minutes": None,
        "fitness_score": None,
        "distance_km": None,
        "backup_suggestions": [],
        "reason_for_assignment": "No available ambulances in the fleet.",
        "ga_metadata": {"generations_run": 0},
    }


def _build_reason(
    ambulance: Dict[str, Any],
    priority_class: str,
    distance_km: float,
    eta_min: float,
    fitness: float,
) -> str:
    cap = ambulance.get("capability_level", 2)
    aid = ambulance.get("id", "N/A")
    return (
        f"Ambulance {aid} selected for {priority_class} emergency. "
        f"Distance: {distance_km:.2f} km, ETA: {eta_min:.1f} min, "
        f"Capability level: {cap}, Fitness: {fitness:.3f}."
    )
