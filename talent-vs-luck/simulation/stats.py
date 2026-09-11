"""Summary statistics for a Talent-vs-Luck simulation run.

Thin wrapper around ``common.stats`` (shared with ``spatial_sim``) that
binds the generic array-based functions to a `SimulationResult`.
"""
from __future__ import annotations

from common.stats import gini, pareto_tail_exponent, summarize_population

from .model import SimulationResult

__all__ = ["gini", "pareto_tail_exponent", "summarize", "summarize_population"]


def summarize(result: SimulationResult) -> dict:
    return summarize_population(result.talent, result.capital)
