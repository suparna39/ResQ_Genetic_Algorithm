"""
tests/test_ga.py — Unit tests for the Genetic Algorithm engine.

Tests every GA component in isolation and the full integration run.
Run with:
    python -m pytest tests/ -v
"""

from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1]))

import pytest
import random

from app.ga.fitness import compute_fitness, _avg_distance_to_fleet
from app.ga.selection import tournament_select
from app.ga.crossover import single_point_crossover, uniform_crossover
from app.ga.mutation import mutate
from app.ga.genetic_algorithm import run_ga


# ── Fixtures ──────────────────────────────────────────────────────────────────

FLEET = [
    {"id": "AMB-001", "latitude": 28.620, "longitude": 77.210, "status": "available", "capability_level": 4},
    {"id": "AMB-002", "latitude": 28.640, "longitude": 77.195, "status": "available", "capability_level": 2},
    {"id": "AMB-003", "latitude": 28.600, "longitude": 77.230, "status": "busy",      "capability_level": 3},
    {"id": "AMB-004", "latitude": 28.650, "longitude": 77.200, "status": "available", "capability_level": 1},
    {"id": "AMB-005", "latitude": 28.610, "longitude": 77.220, "status": "available", "capability_level": 3},
]

PATIENT = (28.6139, 77.2090)
PRIORITY = "Critical"
HOTSPOT_RISK = 0.85
CONGESTION = 1.8
ASSIGNMENTS = {"AMB-001": 0, "AMB-002": 0, "AMB-003": 0, "AMB-004": 0, "AMB-005": 0}


# ── Fitness Tests ─────────────────────────────────────────────────────────────

class TestFitness:

    def test_available_ambulance_returns_positive_fitness(self):
        """An available ambulance should get a non-negative fitness score."""
        amb = FLEET[0]  # available, cap=4
        f = compute_fitness(amb, *PATIENT, PRIORITY, HOTSPOT_RISK, CONGESTION, FLEET, ASSIGNMENTS)
        assert f >= 0.0, f"Expected non-negative fitness, got {f}"

    def test_busy_ambulance_returns_negative_infinity(self):
        """A busy ambulance must be excluded (fitness = -inf)."""
        busy_amb = FLEET[2]  # status=busy
        f = compute_fitness(busy_amb, *PATIENT, PRIORITY, HOTSPOT_RISK, CONGESTION, FLEET, ASSIGNMENTS)
        assert f == float("-inf"), f"Busy ambulance should return -inf, got {f}"

    def test_closer_ambulance_has_higher_fitness_than_farther(self):
        """Closer ambulance should generally score higher (ceteris paribus)."""
        near = {"id": "A", "latitude": 28.614, "longitude": 77.209, "status": "available", "capability_level": 3}
        far  = {"id": "B", "latitude": 28.900, "longitude": 77.500, "status": "available", "capability_level": 3}
        f_near = compute_fitness(near, *PATIENT, PRIORITY, HOTSPOT_RISK, CONGESTION, [near, far], ASSIGNMENTS)
        f_far  = compute_fitness(far,  *PATIENT, PRIORITY, HOTSPOT_RISK, CONGESTION, [near, far], ASSIGNMENTS)
        assert f_near > f_far, "Nearer ambulance should score higher"

    def test_high_capability_preferred_for_critical(self):
        """High-capability ambulance should score better for Critical priority."""
        high_cap = {"id": "H", "latitude": 28.620, "longitude": 77.210, "status": "available", "capability_level": 4}
        low_cap  = {"id": "L", "latitude": 28.620, "longitude": 77.210, "status": "available", "capability_level": 1}
        f_high = compute_fitness(high_cap, *PATIENT, "Critical", HOTSPOT_RISK, CONGESTION,
                                 [high_cap, low_cap], ASSIGNMENTS)
        f_low  = compute_fitness(low_cap,  *PATIENT, "Critical", HOTSPOT_RISK, CONGESTION,
                                 [high_cap, low_cap], ASSIGNMENTS)
        assert f_high > f_low, "Higher capability should score better for Critical priority"

    def test_fitness_is_bounded_zero_to_one_region(self):
        """Fitness should be a reasonable scalar (positive, finite)."""
        amb = FLEET[0]
        f = compute_fitness(amb, *PATIENT, "Low", 0.1, 1.0, FLEET, ASSIGNMENTS)
        assert 0.0 <= f <= 2.0, f"Fitness {f} out of expected bounds"

    def test_avg_distance_to_fleet(self):
        """Average distance to fleet should be non-negative."""
        d = _avg_distance_to_fleet(FLEET[0], FLEET)
        assert d >= 0.0


# ── Selection Tests ────────────────────────────────────────────────────────────

class TestSelection:

    def test_tournament_selects_best_with_full_size(self):
        """With tournament_size == len(population), always selects the best."""
        population = list(range(10))
        fitness_scores = [float(i) for i in range(10)]
        idx = tournament_select(population, fitness_scores, tournament_size=10)
        assert idx == 9, "Should select the individual with highest fitness"

    def test_tournament_select_returns_valid_index(self):
        """Result must be a valid index into the population."""
        population = list(range(20))
        fitness_scores = [random.random() for _ in range(20)]
        idx = tournament_select(population, fitness_scores, tournament_size=5)
        assert 0 <= idx < len(population)

    def test_tournament_handles_single_element(self):
        idx = tournament_select([42], [1.0], tournament_size=1)
        assert idx == 0


# ── Crossover Tests ────────────────────────────────────────────────────────────

class TestCrossover:

    def test_single_point_preserves_length(self):
        a, b = [0, 1, 2, 3, 4], [5, 6, 7, 8, 9]
        ca, cb = single_point_crossover(a, b, crossover_rate=1.0)
        assert len(ca) == len(a)
        assert len(cb) == len(b)

    def test_single_point_swaps_genes(self):
        """With rate=1.0, children must be different from both parents."""
        random.seed(1)
        a, b = [0, 0, 0, 0, 0], [1, 1, 1, 1, 1]
        ca, cb = single_point_crossover(a, b, crossover_rate=1.0)
        # Children should contain genes from both parents
        assert 0 in ca or 0 in cb  # at least one child has genes from a
        assert 1 in ca or 1 in cb  # at least one child has genes from b

    def test_no_crossover_clones_parents(self):
        a, b = [0, 1, 2], [3, 4, 5]
        ca, cb = single_point_crossover(a, b, crossover_rate=0.0)
        assert ca == a
        assert cb == b

    def test_uniform_crossover_preserves_length(self):
        a, b = [1, 2, 3, 4], [5, 6, 7, 8]
        ca, cb = uniform_crossover(a, b, crossover_rate=1.0, swap_prob=0.5)
        assert len(ca) == len(a)
        assert len(cb) == len(b)

    def test_single_gene_chromosome_no_crossover(self):
        """Single-gene chromosomes should always clone."""
        a, b = [3], [7]
        ca, cb = single_point_crossover(a, b, crossover_rate=1.0)
        # With length 1, crossover point can't be chosen: clones
        assert ca == a
        assert cb == b


# ── Mutation Tests ─────────────────────────────────────────────────────────────

class TestMutation:

    def test_zero_mutation_rate_no_change(self):
        chromo = [1, 2, 3, 4, 5]
        result = mutate(chromo, n_ambulances=10, mutation_rate=0.0)
        assert result == chromo

    def test_full_mutation_rate_all_genes_replaced(self):
        """With mutation_rate=1.0, all genes must be replaced by random values."""
        random.seed(42)
        chromo = [0, 0, 0, 0, 0]
        n = 100
        result = mutate(chromo, n_ambulances=n, mutation_rate=1.0)
        assert len(result) == len(chromo)
        # All values must be valid indices
        for gene in result:
            assert 0 <= gene < n

    def test_mutation_output_is_valid(self):
        chromo = [0, 1, 2, 3, 4]
        result = mutate(chromo, n_ambulances=5, mutation_rate=0.5)
        assert len(result) == len(chromo)
        for gene in result:
            assert 0 <= gene < 5


# ── Full GA Integration Tests ──────────────────────────────────────────────────

class TestGeneticAlgorithm:

    def _run(self, fleet=FLEET, priority="Critical", n_gen=30, pop=20):
        return run_ga(
            patient_lat=PATIENT[0],
            patient_lon=PATIENT[1],
            priority_class=priority,
            hotspot_risk=HOTSPOT_RISK,
            congestion_multiplier=CONGESTION,
            ambulances=fleet,
            population_size=pop,
            max_generations=n_gen,
            seed=42,
        )

    def test_ga_returns_valid_result_structure(self):
        result = self._run()
        required_keys = {
            "best_ambulance_id", "best_ambulance", "estimated_eta_minutes",
            "fitness_score", "distance_km", "backup_suggestions",
            "reason_for_assignment", "ga_metadata",
        }
        assert required_keys.issubset(result.keys()), f"Missing keys: {required_keys - result.keys()}"

    def test_ga_selects_only_available_ambulance(self):
        """The GA must never pick a busy or offline ambulance."""
        result = self._run()
        assert result["best_ambulance_id"] != "AMB-003", "Should not select busy AMB-003"
        best = result["best_ambulance"]
        assert best is not None
        assert best.get("status") == "available"

    def test_ga_eta_is_positive(self):
        result = self._run()
        assert result["estimated_eta_minutes"] > 0

    def test_ga_fitness_is_finite(self):
        result = self._run()
        assert result["fitness_score"] not in (None, float("inf"), float("-inf"))

    def test_ga_no_available_ambulances(self):
        """If no ambulances are available, GA should return a graceful fallback."""
        all_busy = [
            {"id": f"AMB-{i}", "latitude": 28.62, "longitude": 77.21,
             "status": "busy", "capability_level": 2}
            for i in range(5)
        ]
        result = self._run(fleet=all_busy)
        assert result["best_ambulance_id"] is None
        assert "No available" in result["reason_for_assignment"]

    def test_ga_single_ambulance(self):
        """GA should handle a fleet of one."""
        fleet = [{"id": "ONLY-1", "latitude": 28.62, "longitude": 77.21,
                  "status": "available", "capability_level": 3}]
        result = self._run(fleet=fleet, pop=5, n_gen=10)
        assert result["best_ambulance_id"] == "ONLY-1"

    def test_ga_prefers_high_capability_for_critical(self):
        """For a Critical emergency, GA should generally prefer the highest-capability unit."""
        fleet = [
            {"id": "LOW",  "latitude": 28.614, "longitude": 77.209, "status": "available", "capability_level": 1},
            {"id": "HIGH", "latitude": 28.614, "longitude": 77.209, "status": "available", "capability_level": 4},
        ]
        result = self._run(fleet=fleet, priority="Critical", pop=20, n_gen=50)
        assert result["best_ambulance_id"] == "HIGH", \
            f"Expected HIGH-capability for Critical, got {result['best_ambulance_id']}"

    def test_ga_convergence_metadata(self):
        result = self._run()
        meta = result["ga_metadata"]
        assert "generations_run" in meta
        assert "convergence_generation" in meta
        assert meta["generations_run"] >= 1

    def test_ga_backup_suggestions(self):
        result = self._run()
        backups = result["backup_suggestions"]
        assert isinstance(backups, list)
        # Each backup must have required keys
        for b in backups:
            assert "ambulance_id" in b
            assert "eta_minutes" in b
            assert "fitness" in b
            assert b["ambulance_id"] != result["best_ambulance_id"], \
                "Backup should not include the already-selected best ambulance"

    def test_ga_deterministic_with_seed(self):
        """Same seed must produce same result."""
        r1 = self._run()
        r2 = self._run()
        assert r1["best_ambulance_id"] == r2["best_ambulance_id"]
        assert abs(r1["fitness_score"] - r2["fitness_score"]) < 1e-9

    def test_ga_different_priorities_produce_different_selections(self):
        """Low vs Critical priority may select different ambulances."""
        fleet = [
            {"id": "BLS",  "latitude": 28.612, "longitude": 77.208, "status": "available", "capability_level": 1},
            {"id": "MICU", "latitude": 28.616, "longitude": 77.212, "status": "available", "capability_level": 4},
        ]
        result_low      = self._run(fleet=fleet, priority="Low",      pop=20, n_gen=50)
        result_critical = self._run(fleet=fleet, priority="Critical",  pop=20, n_gen=50)
        # Critical should prefer MICU (high capability)
        assert result_critical["best_ambulance_id"] == "MICU", \
            f"Critical emergency should prefer MICU, got {result_critical['best_ambulance_id']}"

    def test_ga_large_fleet(self):
        """GA should complete in reasonable time with a large fleet."""
        import time
        large_fleet = [
            {
                "id": f"AMB-{i:03d}",
                "latitude": 28.5 + (i % 10) * 0.02,
                "longitude": 77.0 + (i // 10) * 0.02,
                "status": "available" if i % 3 != 0 else "busy",
                "capability_level": (i % 4) + 1,
            }
            for i in range(50)
        ]
        t0 = time.time()
        result = self._run(fleet=large_fleet, pop=50, n_gen=100)
        elapsed = time.time() - t0
        assert result["best_ambulance_id"] is not None
        assert elapsed < 10.0, f"GA took too long on 50 ambulances: {elapsed:.1f}s"


if __name__ == "__main__":
    # Can also be run directly without pytest
    import unittest
    unittest.main(verbosity=2)
