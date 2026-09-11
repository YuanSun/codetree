"""Headless mechanics for the 2D spatial Talent-vs-Luck simulation.

This is the literal mechanic described in Pluchino, Biondo & Rapisarda
(2018): agents sit at fixed points on a 201x201 toroidal grid; "lucky"
(green) and "unlucky" (red) particles random-walk across the same grid
and trigger an event whenever they land near an agent. A lucky event
only pays off if the agent's talent roll succeeds; an unlucky event
always halves the agent's capital.

Kept free of any rendering dependency (pygame lives in main.py) so the
mechanics can be unit tested and reused headlessly — see ``../simulation``
for a faster, non-spatial approximation of the same model.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np

GRID_SIZE = 201


@dataclass
class World:
    n_agents: int = 1000
    n_lucky: int = 250
    n_unlucky: int = 250
    grid_size: int = GRID_SIZE
    initial_capital: float = 10.0
    talent_mean: float = 0.6
    talent_std: float = 0.1
    collision_radius: float = 1.0
    seed: Optional[int] = None

    def __post_init__(self) -> None:
        rng = np.random.default_rng(self.seed)
        self._rng = rng

        self.talent = np.clip(rng.normal(self.talent_mean, self.talent_std, self.n_agents), 0.0, 1.0)
        self.capital = np.full(self.n_agents, self.initial_capital, dtype=float)
        self.agent_pos = rng.integers(0, self.grid_size, size=(self.n_agents, 2)).astype(float)
        self.lucky_pos = rng.integers(0, self.grid_size, size=(self.n_lucky, 2)).astype(float)
        self.unlucky_pos = rng.integers(0, self.grid_size, size=(self.n_unlucky, 2)).astype(float)

        self.step_count = 0
        self.lucky_events = np.zeros(self.n_agents, dtype=int)
        self.unlucky_events = np.zeros(self.n_agents, dtype=int)

    def _random_walk(self, pos: np.ndarray) -> np.ndarray:
        moves = self._rng.integers(-1, 2, size=pos.shape)  # each axis in {-1, 0, 1}
        return (pos + moves) % self.grid_size

    def _hits(self, particle_pos: np.ndarray) -> np.ndarray:
        """Boolean mask (n_agents,): which agents a set of particles landed on."""
        diff = np.abs(particle_pos[:, None, :] - self.agent_pos[None, :, :])
        diff = np.minimum(diff, self.grid_size - diff)  # shortest distance on the torus
        dist = np.sqrt((diff**2).sum(axis=2))
        return (dist <= self.collision_radius).any(axis=0)

    def move_particles(self) -> None:
        self.lucky_pos = self._random_walk(self.lucky_pos)
        self.unlucky_pos = self._random_walk(self.unlucky_pos)

    def apply_collisions(self) -> None:
        lucky_hit = self._hits(self.lucky_pos)
        unlucky_hit = self._hits(self.unlucky_pos)

        roll = self._rng.random(self.n_agents)
        seizes = lucky_hit & (roll < self.talent)
        self.capital[seizes] *= 2.0
        self.capital[unlucky_hit] *= 0.5

        self.lucky_events += seizes
        self.unlucky_events += unlucky_hit

    def step(self) -> None:
        self.move_particles()
        self.apply_collisions()
        self.step_count += 1
