"""Pygame front-end for the 2D spatial Talent-vs-Luck simulation.

Renders 1000 agents (grey dots, fixed) and 500 lucky/unlucky particles
(green/red dots, random-walking) on a toroidal grid, plus a live
dashboard tracking the wealthiest agent against the most talented one —
the paper's central point made visible: they are almost never the same
dot, and the most-talented dot's fortunes are largely luck of the draw.

Run:
    python -m spatial_sim.main
    python -m spatial_sim.main --seed 42 --steps 80

Controls: space to pause/resume, escape or window close to quit.
"""
from __future__ import annotations

import argparse
from typing import Optional

import numpy as np
import pygame

from .world import World

WINDOW_W, WINDOW_H = 960, 700
SIM_W = 700
DASH_W = WINDOW_W - SIM_W
FPS = 30
STEPS_PER_SECOND = 4

BG = (10, 10, 14)
PANEL_BG = (24, 24, 30)
AGENT_COLOR = (190, 190, 200)
LUCKY_COLOR = (80, 220, 120)
UNLUCKY_COLOR = (230, 70, 70)
TOP1_COLOR = (255, 200, 60)
MAX_TALENT_RING = (90, 170, 255)
TEXT_COLOR = (230, 230, 235)


def to_screen(pos: np.ndarray, grid_size: int, w: int, h: int):
    x = pos[:, 0] / grid_size * w
    y = pos[:, 1] / grid_size * h
    return x, y


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--steps", type=int, default=80, help="half-year steps (80 = 40 years)")
    parser.add_argument("--seed", type=int, default=None)
    return parser.parse_args(argv)


def run(n_steps: int = 80, seed: Optional[int] = None) -> None:
    pygame.init()
    screen = pygame.display.set_mode((WINDOW_W, WINDOW_H))
    pygame.display.set_caption("Talent vs Luck -- spatial simulation")
    clock = pygame.time.Clock()
    font = pygame.font.SysFont("consolas", 16)

    world = World(seed=seed)
    max_talent_idx = int(np.argmax(world.talent))
    top1_history: list[float] = [world.capital.max()]

    frame = 0
    paused = False
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    paused = not paused
                elif event.key == pygame.K_ESCAPE:
                    running = False

        ticks_per_step = max(FPS // STEPS_PER_SECOND, 1)
        if not paused and world.step_count < n_steps and frame % ticks_per_step == 0:
            world.step()
            top1_history.append(world.capital.max())

        screen.fill(BG)
        _draw_simulation(screen, world, max_talent_idx)
        _draw_dashboard(screen, font, world, max_talent_idx, top1_history, n_steps)

        pygame.display.flip()
        clock.tick(FPS)
        frame += 1

    pygame.quit()


def _draw_simulation(screen, world: World, max_talent_idx: int) -> None:
    pygame.draw.rect(screen, (6, 6, 10), pygame.Rect(0, 0, SIM_W, WINDOW_H))

    ax, ay = to_screen(world.agent_pos, world.grid_size, SIM_W, WINDOW_H)
    for x, y in zip(ax, ay):
        pygame.draw.circle(screen, AGENT_COLOR, (int(x), int(y)), 2)

    lx, ly = to_screen(world.lucky_pos, world.grid_size, SIM_W, WINDOW_H)
    for x, y in zip(lx, ly):
        pygame.draw.circle(screen, LUCKY_COLOR, (int(x), int(y)), 2)

    ux, uy = to_screen(world.unlucky_pos, world.grid_size, SIM_W, WINDOW_H)
    for x, y in zip(ux, uy):
        pygame.draw.circle(screen, UNLUCKY_COLOR, (int(x), int(y)), 2)

    top1_idx = int(np.argmax(world.capital))
    tx, ty = to_screen(world.agent_pos[top1_idx : top1_idx + 1], world.grid_size, SIM_W, WINDOW_H)
    pygame.draw.circle(screen, TOP1_COLOR, (int(tx[0]), int(ty[0])), 6, width=2)

    mx, my = to_screen(world.agent_pos[max_talent_idx : max_talent_idx + 1], world.grid_size, SIM_W, WINDOW_H)
    pygame.draw.circle(screen, MAX_TALENT_RING, (int(mx[0]), int(my[0])), 6, width=2)


def _draw_dashboard(screen, font, world: World, max_talent_idx: int, top1_history, n_steps: int) -> None:
    dash_rect = pygame.Rect(SIM_W, 0, DASH_W, WINDOW_H)
    pygame.draw.rect(screen, PANEL_BG, dash_rect)

    top1_idx = int(np.argmax(world.capital))
    lines = [
        f"step {world.step_count}/{n_steps}",
        "",
        "Top-1 (yellow ring):",
        f"  capital  {world.capital[top1_idx]:,.1f}",
        f"  talent   {world.talent[top1_idx]:.3f}",
        "",
        "Most talented (blue ring):",
        f"  talent   {world.talent[max_talent_idx]:.3f}",
        f"  capital  {world.capital[max_talent_idx]:,.1f}",
        f"  rank     {int((world.capital > world.capital[max_talent_idx]).sum()) + 1} / {world.n_agents}",
        "",
        f"median capital  {np.median(world.capital):,.1f}",
        f"mean capital    {world.capital.mean():,.1f}",
        "",
        "[space] pause   [esc] quit",
    ]
    for i, line in enumerate(lines):
        surf = font.render(line, True, TEXT_COLOR)
        screen.blit(surf, (SIM_W + 16, 16 + i * 20))

    if len(top1_history) > 1:
        plot_rect = pygame.Rect(SIM_W + 16, WINDOW_H - 220, DASH_W - 32, 180)
        pygame.draw.rect(screen, (10, 10, 14), plot_rect)
        hist = np.array(top1_history)
        hmax = hist.max() or 1.0
        points = [
            (
                plot_rect.left + i / max(len(hist) - 1, 1) * plot_rect.width,
                plot_rect.bottom - (v / hmax) * plot_rect.height,
            )
            for i, v in enumerate(hist)
        ]
        if len(points) > 1:
            pygame.draw.lines(screen, TOP1_COLOR, False, points, 2)
        label = font.render("Top-1 capital over time", True, TEXT_COLOR)
        screen.blit(label, (plot_rect.left, plot_rect.top - 20))


if __name__ == "__main__":
    args = parse_args()
    run(n_steps=args.steps, seed=args.seed)
