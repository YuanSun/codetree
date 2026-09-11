"""Talent vs Luck agent-based model — mean-field, vectorized version.

Reproduces the core dynamics of Pluchino, Biondo & Rapisarda (2018),
"Talent vs. Luck: The Role of Randomness in Success and Failure"
(arXiv:1802.07068): talent is normally distributed across a population,
yet a working life punctuated by random lucky/unlucky events turns that
symmetric distribution into a heavily skewed wealth distribution, and the
wealthiest individuals are rarely the most talented ones.

This module trades the paper's literal spatial mechanic (green/red
particles random-walking on a torus grid and colliding with fixed agents)
for a non-spatial approximation: each agent independently rolls for a
lucky/unlucky encounter every step with a fixed probability. That makes
the whole population update a handful of vectorized NumPy operations, so
thousands of full 40-year careers can be simulated per second. For the
literal spatial mechanic, see ``../spatial_sim``.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np


@dataclass
class SimulationConfig:
    n_agents: int = 1000
    n_steps: int = 80  # 40-year career, half-year steps
    talent_mean: float = 0.6
    talent_std: float = 0.1
    initial_capital: float = 10.0
    event_rate: float = 0.5  # P(agent encounters *any* event this step)
    lucky_share: float = 0.5  # P(event is lucky | an event happens)
    lucky_multiplier: float = 2.0
    unlucky_multiplier: float = 0.5
    seed: Optional[int] = None


@dataclass
class SimulationResult:
    talent: np.ndarray  # (n_agents,)
    capital: np.ndarray  # (n_agents,) final capital
    capital_history: np.ndarray  # (n_steps + 1, n_agents)
    lucky_events: np.ndarray  # (n_agents,) count of seized lucky events
    unlucky_events: np.ndarray  # (n_agents,) count of unlucky hits


def sample_talent(rng: np.random.Generator, n_agents: int, mean: float, std: float) -> np.ndarray:
    talent = rng.normal(mean, std, size=n_agents)
    return np.clip(talent, 0.0, 1.0)


def run_simulation(config: SimulationConfig) -> SimulationResult:
    rng = np.random.default_rng(config.seed)
    talent = sample_talent(rng, config.n_agents, config.talent_mean, config.talent_std)
    capital = np.full(config.n_agents, config.initial_capital, dtype=float)

    history = np.empty((config.n_steps + 1, config.n_agents))
    history[0] = capital
    lucky_events = np.zeros(config.n_agents, dtype=int)
    unlucky_events = np.zeros(config.n_agents, dtype=int)

    for step in range(1, config.n_steps + 1):
        has_event = rng.random(config.n_agents) < config.event_rate
        is_lucky = has_event & (rng.random(config.n_agents) < config.lucky_share)
        is_unlucky = has_event & ~is_lucky

        # A lucky event only pays off if the agent "seizes" it — the
        # paper's stand-in for talent as the ability to recognize and
        # exploit an opportunity, rather than a guarantee of success.
        seizes = is_lucky & (rng.random(config.n_agents) < talent)
        capital[seizes] *= config.lucky_multiplier
        capital[is_unlucky] *= config.unlucky_multiplier

        lucky_events += seizes
        unlucky_events += is_unlucky
        history[step] = capital

    return SimulationResult(talent, capital, history, lucky_events, unlucky_events)
