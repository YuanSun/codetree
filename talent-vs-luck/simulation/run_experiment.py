"""CLI: run the vectorized Talent-vs-Luck simulation and report the results.

Examples:
    python -m simulation.run_experiment
    python -m simulation.run_experiment --seed 42 --plot out.png
    python -m simulation.run_experiment --n-agents 5000 --event-rate 0.3
"""
from __future__ import annotations

import argparse
import json

from .model import SimulationConfig, run_simulation
from .stats import summarize


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--n-agents", type=int, default=1000)
    parser.add_argument("--n-steps", type=int, default=80, help="half-year steps (80 = 40 years)")
    parser.add_argument("--talent-mean", type=float, default=0.6)
    parser.add_argument("--talent-std", type=float, default=0.1)
    parser.add_argument("--event-rate", type=float, default=0.5, help="P(any event) per agent per step")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--plot", type=str, default=None, help="path to save a summary figure (PNG)")
    return parser.parse_args(argv)


def main(argv=None) -> None:
    args = parse_args(argv)
    config = SimulationConfig(
        n_agents=args.n_agents,
        n_steps=args.n_steps,
        talent_mean=args.talent_mean,
        talent_std=args.talent_std,
        event_rate=args.event_rate,
        seed=args.seed,
    )
    result = run_simulation(config)
    print(json.dumps(summarize(result), indent=2))

    if args.plot:
        _plot(result, args.plot)
        print(f"saved figure to {args.plot}")


def _plot(result, path: str) -> None:
    import matplotlib
    import numpy as np

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(1, 3, figsize=(15, 4.5))

    axes[0].hist(result.talent, bins=30, color="#4c78a8")
    axes[0].set_title("Talent distribution")
    axes[0].set_xlabel("talent")

    positive_capital = result.capital[result.capital > 0]
    log_bins = np.logspace(
        np.log10(max(positive_capital.min(), 1e-6)), np.log10(positive_capital.max()), 40
    )
    axes[1].hist(positive_capital, bins=log_bins, color="#f58518")
    axes[1].set_xscale("log")
    axes[1].set_title("Final capital distribution")
    axes[1].set_xlabel("capital (log scale)")

    axes[2].scatter(result.talent, result.capital, s=6, alpha=0.5, color="#54a24b")
    axes[2].set_title("Talent vs. capital")
    axes[2].set_xlabel("talent")
    axes[2].set_ylabel("capital (log scale)")
    axes[2].set_yscale("log")

    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


if __name__ == "__main__":
    main()
