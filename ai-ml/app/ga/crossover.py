"""GA crossover operator — single-point crossover on chromosome vectors."""

from __future__ import annotations

import random
from typing import List, Tuple


def single_point_crossover(
    parent_a: List[int],
    parent_b: List[int],
    crossover_rate: float = 0.8,
) -> Tuple[List[int], List[int]]:
    """
    Single-point crossover.

    With probability `crossover_rate` a crossover point is chosen and
    the tails of the two parent chromosomes are swapped.
    If the chromosomes have length 1 (single ambulance assignment) the
    crossover is effectively a swap of the whole chromosome.

    Parameters
    ----------
    parent_a, parent_b : list[int]
        Integer chromosome vectors (ambulance indices).
    crossover_rate : float
        Probability of performing crossover vs. cloning.

    Returns
    -------
    Tuple[list[int], list[int]]
        Two offspring chromosomes.
    """
    if random.random() > crossover_rate or len(parent_a) <= 1:
        return list(parent_a), list(parent_b)

    point = random.randint(1, len(parent_a) - 1)
    child_a = parent_a[:point] + parent_b[point:]
    child_b = parent_b[:point] + parent_a[point:]
    return child_a, child_b


def uniform_crossover(
    parent_a: List[int],
    parent_b: List[int],
    crossover_rate: float = 0.8,
    swap_prob: float = 0.5,
) -> Tuple[List[int], List[int]]:
    """
    Uniform crossover: each gene is independently swapped with probability `swap_prob`.
    """
    if random.random() > crossover_rate:
        return list(parent_a), list(parent_b)

    child_a, child_b = [], []
    for a, b in zip(parent_a, parent_b):
        if random.random() < swap_prob:
            child_a.append(b)
            child_b.append(a)
        else:
            child_a.append(a)
            child_b.append(b)
    return child_a, child_b
