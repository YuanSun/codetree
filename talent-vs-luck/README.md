# Talent vs Luck

A code implementation of the agent-based model from Alessandro Pluchino,
Alessio Emanuele Biondo & Andrea Rapisarda, *"Talent vs. Luck: The Role of
Randomness in Success and Failure"*, Advances in Complex Systems 21 (2018)
(preprint: [arXiv:1802.07068](https://arxiv.org/abs/1802.07068); winner of
the 2022 Ig Nobel Prize in Economics).

## The paper, in short

- Talent is normally distributed across a population. Wealth, after a
  40-year career punctuated by random lucky and unlucky events, is not —
  it ends up heavily skewed, Pareto-like, "80/20" unequal.
- The wealthiest people are usually **not** the most talented. They tend
  to be moderately above-average in talent (talent around 0.6-0.7) who
  happened to catch a long run of good luck with little bad luck.
- The most talented individuals (talent 0.9+) rarely end up on top: one
  or two unlucky hits mid-career are enough to sink them to mediocre or
  below-average outcomes, because reward is gated on *encountering* an
  opportunity, not just having the talent to exploit it.
- A follow-up experiment on research-funding strategies finds that
  spreading funding evenly across many projects outperforms
  "reward past winners" elitist strategies at surfacing real breakthroughs
  — because both strategies mostly reward luck, and elitism just
  compounds it.

## Two implementations

| | `simulation/` | `spatial_sim/` |
|---|---|---|
| **Mechanic** | Non-spatial approximation: each step, every agent independently rolls for a lucky/unlucky encounter | The paper's literal mechanic: green/red "event" particles random-walk on a 201x201 toroidal grid and collide with fixed agents |
| **Stack** | NumPy (fully vectorized) | NumPy + Pygame (real-time render + dashboard) |
| **Good for** | Fast Monte Carlo, sweeping parameters, fitting the wealth distribution's tail, batch statistics | Watching the dynamics unfold, seeing spatial clustering of luck, tracking a specific high-talent agent's fortunes live |

Both share the same core parameters: 1000 agents, talent ~
`N(0.6, 0.1)` clipped to `[0, 1]`, starting capital 10, an 80-step career
(half-year steps over 40 years), a lucky event doubles capital, an
unlucky event halves it.

## `simulation/` — vectorized Monte Carlo

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run once, print summary statistics as JSON
python -m simulation.run_experiment --seed 42

# Also save a 3-panel figure (talent histogram, capital histogram, talent-vs-capital scatter)
python -m simulation.run_experiment --seed 42 --plot report.png

# Sweep parameters
python -m simulation.run_experiment --n-agents 5000 --event-rate 0.3
```

Reported statistics include the Gini coefficient of capital vs. talent,
an estimated Pareto tail exponent, and — the paper's headline result —
where the richest agent's talent sits in the talent-percentile ranking,
and where the most-talented agent's capital sits in the wealth-percentile
ranking (these are usually far apart).

`simulation/model.py` holds the core `run_simulation()` function;
`simulation/stats.py` the summary statistics. See module docstrings for
how the non-spatial approximation relates to the paper's model — it
swaps the literal spatial collision mechanic for a per-agent encounter
probability (`--event-rate`), trading exactness for O(agents) vectorized
updates.

Every agent's full career is recorded, not just the final numbers — see
**Reports** below to browse what any individual agent actually
experienced.

## `spatial_sim/` — 2D spatial visualization

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

python -m spatial_sim.main --seed 42
```

Renders 1000 fixed agents plus 250 lucky (green) and 250 unlucky (red)
particles random-walking on a toroidal grid, at 4 simulated half-years
per second. A side dashboard tracks the current wealthiest agent (yellow
ring) against the single most-talented agent (blue ring) in real time.
**Click any agent dot** to select it (purple ring) — the dashboard then
also shows that agent's live talent, capital, wealth rank, and lucky/
unlucky counts, plus its own capital sparkline. Press `space` to pause/
resume, `escape` or close the window to quit.

When the run ends — either it plays out to `--steps`, or you quit early —
a numeric and an interactive HTML report are saved automatically to
`--report-dir` (default `reports/`, gitignored); see **Reports** below.
Pass `--open-browser` to have the HTML report open automatically, or
`--no-report` to skip saving.

`spatial_sim/world.py` holds the pygame-free simulation mechanics
(`World.step()`), so they're unit tested without needing a display;
`spatial_sim/main.py` is purely the render loop on top of it.

## Reports: the numeric summary and each agent's life story

Both implementations record every agent's full career, not just their
final numbers: a chronological `life_events` log (each lucky opportunity
seized or missed, each unlucky hit, and the capital before/after) and a
step-by-step `capital_history`. `common/report.py` (shared by both
packages) turns that into two artifacts:

- **Numeric report** (`--report path.json` / auto-saved by `spatial_sim`):
  population statistics (Gini, Pareto exponent, talent↔capital
  correlation, the richest agent's talent percentile, the most-talented
  agent's wealth percentile) plus a full per-agent table (talent, final
  capital, wealth rank, lucky-seized/missed/unlucky counts).
- **Interactive HTML report** (`--html-report path.html` / auto-saved by
  `spatial_sim`): a single, dependency-free file you open directly in a
  browser. It has a searchable, sortable table of every agent; click any
  row (or the "Wealthiest" / "Most talented" shortcut buttons) to see
  that agent's capital trajectory chart and a narrated, step-by-step
  timeline of their career — e.g. *"Step 11 (year 5.5): Hit by
  misfortune — capital 80 → 40"*. This is the direct way to answer "what
  did agent #42 actually experience in their life?"

```bash
# vectorized simulation: save both reports alongside the console summary
python -m simulation.run_experiment --seed 42 --report out.json --html-report out.html

# spatial simulation: reports are saved automatically when the run ends
python -m spatial_sim.main --seed 42 --report-dir reports --open-browser
```

## Tests

```bash
python -m pytest simulation/tests spatial_sim/tests common/tests
```

## Notes on parameters

The paper doesn't publish an exact closed-form for how often a given
agent bumps into an event particle under the spatial mechanic — it falls
out of the grid size, particle count, and random-walk step size. The
defaults here (`event_rate=0.5` for the vectorized model,
`collision_radius=1.0` on a 201x201 grid for the spatial model) are
reasonable starting points, not values lifted from the paper; both are
exposed as parameters so you can tune the encounter frequency and
compare the two implementations against each other.
