"""GA selection operator — tournament selection."""

from __future__ import annotations

import random
from typing import List, Tuple

from app.core.config import GA_TOURNAMENT_SIZE


def tournament_select(
    population: List[int],
    fitness_scores: List[float],
    tournament_size: int = GA_TOURNAMENT_SIZE,
) -> int:
    """
    Tournament selection: randomly pick `tournament_size` candidates and
    return the index of the one with the highest fitness.

    Parameters
    ----------
    population : list[int]
        Indices into the ambulance fleet (one per individual).
    fitness_scores : list[float]
        Fitness value for each individual in `population`.
    tournament_size : int
        Number of candidates per tournament.

    Returns
    -------
    int
        Index of the selected individual in `population`.
    """
    candidates = random.sample(range(len(population)), min(tournament_size, len(population)))
    best = max(candidates, key=lambda idx: fitness_scores[idx])
    return best
