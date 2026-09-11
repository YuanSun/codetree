"""Summary statistics for a Talent-vs-Luck simulation run."""
from __future__ import annotations

from typing import Optional

import numpy as np

from .model import SimulationResult


def gini(values: np.ndarray) -> float:
    """Gini coefficient of inequality, 0 (perfectly equal) to ~1 (concentrated)."""
    x = np.sort(np.asarray(values, dtype=float))
    n = x.size
    total = x.sum()
    if n == 0 or total == 0:
        return 0.0
    cum = np.cumsum(x)
    return float((n + 1 - 2 * (cum.sum() / cum[-1])) / n)


def pareto_tail_exponent(values: np.ndarray, tail_fraction: float = 0.2) -> Optional[float]:
    """Rough Pareto (power-law) exponent of the upper tail.

    Fits a line to log(rank/n) vs log(value) over the top `tail_fraction`
    of the sample — a standard quick-and-dirty estimator for how fat the
    tail is. Returns None when there isn't enough data to fit.
    """
    x = np.sort(np.asarray(values, dtype=float))[::-1]
    n = x.size
    k = max(int(n * tail_fraction), 5)
    if k >= n or x[k - 1] <= 0:
        return None
    tail = x[:k]
    ranks = np.arange(1, k + 1)
    slope, _ = np.polyfit(np.log(tail), np.log(ranks / n), 1)
    return float(-slope)


def summarize(result: SimulationResult) -> dict:
    capital = result.capital
    talent = result.talent
    top_idx = int(np.argmax(capital))
    max_talent_idx = int(np.argmax(talent))
    return {
        "n_agents": int(capital.size),
        "mean_capital": float(capital.mean()),
        "median_capital": float(np.median(capital)),
        "gini_capital": gini(capital),
        "gini_talent": gini(talent),
        "pareto_exponent": pareto_tail_exponent(capital),
        "top_capital": float(capital[top_idx]),
        "top_capital_talent": float(talent[top_idx]),
        "top_capital_talent_percentile": float((talent < talent[top_idx]).mean() * 100),
        "max_talent": float(talent[max_talent_idx]),
        "max_talent_capital": float(capital[max_talent_idx]),
        "max_talent_capital_percentile": float((capital < capital[max_talent_idx]).mean() * 100),
        "corr_talent_capital": float(np.corrcoef(talent, capital)[0, 1]),
    }
