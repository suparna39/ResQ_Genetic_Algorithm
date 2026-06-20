"""GA mutation operator."""

from __future__ import annotations

import random
from typing import List


def mutate(
    chromosome: List[int],
    n_ambulances: int,
    mutation_rate: float = 0.05,
) -> List[int]:
    """
    Gene-level mutation.

    Each gene in the chromosome is independently replaced by a random
    ambulance index with probability `mutation_rate`.

    Parameters
    ----------
    chromosome : list[int]
        Current chromosome (list of ambulance fleet indices).
    n_ambulances : int
        Total number of ambulances in the fleet.
    mutation_rate : float
        Per-gene mutation probability.

    Returns
    -------
    list[int]
        Mutated chromosome.
    """
    mutated = []
    for gene in chromosome:
        if random.random() < mutation_rate:
            mutated.append(random.randint(0, n_ambulances - 1))
        else:
            mutated.append(gene)
    return mutated
