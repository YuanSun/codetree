"""Pygame front-end for the 2D spatial Talent-vs-Luck simulation.

Renders 1000 agents (grey dots, fixed) and 500 lucky/unlucky particles
(green/red dots, random-walking) on a toroidal grid, plus a live
dashboard tracking the wealthiest agent against the most talented one —
the paper's central point made visible: they are almost never the same
dot, and the most-talented dot's fortunes are largely luck of the draw.

Click any agent dot to select it and inspect its own stats live. When
the run ends (steps exhausted, or you quit early), a numeric JSON report
and a self-contained interactive HTML report — with every agent's full
life story — are saved to --report-dir.

Run:
    python -m spatial_sim.main
    python -m spatial_sim.main --seed 42 --steps 80 --open-browser

Controls: click an agent to select it, space to pause/resume, escape or
window close to quit (and save the reports so far).
"""
from __future__ import annotations

import argparse
import datetime
import webbrowser
from pathlib import Path
from typing import Optional

import numpy as np
import pygame

from common.report import save_interactive_report, save_numeric_report

from .world import World

WINDOW_W, WINDOW_H = 1040, 760
SIM_W = 700
DASH_W = WINDOW_W - SIM_W
FPS = 30
STEPS_PER_SECOND = 4
CLICK_RADIUS_PX = 12

BG = (10, 10, 14)
PANEL_BG = (24, 24, 30)
AGENT_COLOR = (190, 190, 200)
LUCKY_COLOR = (80, 220, 120)
UNLUCKY_COLOR = (230, 70, 70)
TOP1_COLOR = (255, 200, 60)
MAX_TALENT_RING = (90, 170, 255)
SELECTED_RING = (200, 110, 255)
TEXT_COLOR = (230, 230, 235)


def to_screen(pos: np.ndarray, grid_size: int, w: int, h: int):
    x = pos[:, 0] / grid_size * w
    y = pos[:, 1] / grid_size * h
    return x, y


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--steps", type=int, default=80, help="half-year steps (80 = 40 years)")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--report-dir", type=str, default="reports", help="where to save end-of-run reports")
    parser.add_argument("--no-report", action="store_true", help="skip saving reports when the run ends")
    parser.add_argument("--open-browser", action="store_true", help="open the HTML report when it's saved")
    return parser.parse_args(argv)


def run(n_steps: int = 80, seed: Optional[int] = None, report_dir: Optional[str] = "reports", open_browser: bool = False) -> None:
    pygame.init()
    screen = pygame.display.set_mode((WINDOW_W, WINDOW_H))
    pygame.display.set_caption("Talent vs Luck -- spatial simulation")
    clock = pygame.time.Clock()
    font = pygame.font.SysFont("consolas", 16)

    world = World(seed=seed)
    max_talent_idx = int(np.argmax(world.talent))
    selected_idx: Optional[int] = None
    reports_saved = False

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
            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                clicked = _pick_agent(world, event.pos)
                if clicked is not None:
                    selected_idx = clicked

        ticks_per_step = max(FPS // STEPS_PER_SECOND, 1)
        if not paused and world.step_count < n_steps and frame % ticks_per_step == 0:
            world.step()

        if report_dir and not reports_saved and world.step_count >= n_steps:
            _save_reports(world, n_steps, seed, report_dir, open_browser)
            reports_saved = True

        screen.fill(BG)
        _draw_simulation(screen, world, max_talent_idx, selected_idx)
        _draw_dashboard(screen, font, world, max_talent_idx, selected_idx, n_steps)

        pygame.display.flip()
        clock.tick(FPS)
        frame += 1

    if report_dir and not reports_saved:
        _save_reports(world, n_steps, seed, report_dir, open_browser)
        reports_saved = True

    pygame.quit()


def _pick_agent(world: World, mouse_pos) -> Optional[int]:
    if mouse_pos[0] >= SIM_W:
        return None
    ax, ay = to_screen(world.agent_pos, world.grid_size, SIM_W, WINDOW_H)
    dist2 = (ax - mouse_pos[0]) ** 2 + (ay - mouse_pos[1]) ** 2
    idx = int(np.argmin(dist2))
    if dist2[idx] > CLICK_RADIUS_PX**2:
        return None
    return idx


def _save_reports(world: World, n_steps: int, seed: Optional[int], report_dir: str, open_browser: bool) -> None:
    out_dir = Path(report_dir)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = out_dir / f"spatial_run_{timestamp}.json"
    html_path = out_dir / f"spatial_run_{timestamp}.html"
    meta = {
        "implementation": "spatial simulation",
        "n_agents": world.n_agents,
        "n_steps": n_steps,
        "steps_completed": world.step_count,
        "seed": seed,
        "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
    }
    save_numeric_report(str(json_path), world.talent, world.capital, world.life_events, meta)
    save_interactive_report(
        str(html_path), world.talent, world.capital, world.life_events, world.capital_history, meta
    )
    print(f"saved numeric report to {json_path}")
    print(f"saved interactive report to {html_path}")
    if open_browser:
        webbrowser.open(html_path.resolve().as_uri())


def _draw_simulation(screen, world: World, max_talent_idx: int, selected_idx: Optional[int]) -> None:
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

    if selected_idx is not None:
        sx, sy = to_screen(world.agent_pos[selected_idx : selected_idx + 1], world.grid_size, SIM_W, WINDOW_H)
        pygame.draw.circle(screen, SELECTED_RING, (int(sx[0]), int(sy[0])), 8, width=2)


def _agent_lines(world: World, idx: int) -> list:
    lucky_seized = sum(1 for e in world.life_events[idx] if e["type"] == "lucky_seized")
    lucky_missed = sum(1 for e in world.life_events[idx] if e["type"] == "lucky_missed")
    unlucky = sum(1 for e in world.life_events[idx] if e["type"] == "unlucky")
    rank = int((world.capital > world.capital[idx]).sum()) + 1
    return [
        f"  talent    {world.talent[idx]:.3f}",
        f"  capital   {world.capital[idx]:,.1f}",
        f"  rank      {rank} / {world.n_agents}",
        f"  lucky     {lucky_seized} seized, {lucky_missed} missed",
        f"  unlucky   {unlucky}",
    ]


def _draw_dashboard(
    screen, font, world: World, max_talent_idx: int, selected_idx: Optional[int], n_steps: int
) -> None:
    dash_rect = pygame.Rect(SIM_W, 0, DASH_W, WINDOW_H)
    pygame.draw.rect(screen, PANEL_BG, dash_rect)

    top1_idx = int(np.argmax(world.capital))
    lines = [f"step {world.step_count}/{n_steps}", "", "Top-1 (yellow ring):"] + _agent_lines(world, top1_idx)
    lines += ["", "Most talented (blue ring):"] + _agent_lines(world, max_talent_idx)
    if selected_idx is not None:
        lines += ["", f"Selected #{selected_idx} (purple ring):"] + _agent_lines(world, selected_idx)
    lines += [
        "",
        f"median capital  {np.median(world.capital):,.1f}",
        f"mean capital    {world.capital.mean():,.1f}",
        "",
        "[click] select agent",
        "[space] pause   [esc] quit",
    ]
    for i, line in enumerate(lines):
        surf = font.render(line, True, TEXT_COLOR)
        screen.blit(surf, (SIM_W + 16, 16 + i * 18))

    plot_idx = selected_idx if selected_idx is not None else top1_idx
    plot_label = f"Agent #{plot_idx} capital over time" if selected_idx is not None else "Top-1 capital over time"
    _draw_sparkline(screen, font, world, plot_idx, plot_label)


def _draw_sparkline(screen, font, world: World, agent_idx: int, label: str) -> None:
    hist = np.array([snapshot[agent_idx] for snapshot in world.capital_history])
    if hist.size < 2:
        return
    plot_rect = pygame.Rect(SIM_W + 16, WINDOW_H - 220, DASH_W - 32, 180)
    pygame.draw.rect(screen, (10, 10, 14), plot_rect)
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
    label_surf = font.render(label, True, TEXT_COLOR)
    screen.blit(label_surf, (plot_rect.left, plot_rect.top - 20))


if __name__ == "__main__":
    args = parse_args()
    run(
        n_steps=args.steps,
        seed=args.seed,
        report_dir=None if args.no_report else args.report_dir,
        open_browser=args.open_browser,
    )
