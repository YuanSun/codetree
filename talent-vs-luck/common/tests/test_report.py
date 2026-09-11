import json

import numpy as np

from common.report import save_interactive_report, save_numeric_report
from common.stats import gini, pareto_tail_exponent, summarize_population


def _toy_population(seed=0, n=20):
    rng = np.random.default_rng(seed)
    talent = np.clip(rng.normal(0.6, 0.1, n), 0, 1)
    capital = rng.lognormal(mean=1.0, sigma=1.5, size=n)
    life_events = [
        [
            {"step": 1, "type": "lucky_seized", "capital_before": 10.0, "capital_after": 20.0},
            {"step": 3, "type": "unlucky", "capital_before": 20.0, "capital_after": 10.0},
        ]
        if i % 3 == 0
        else []
        for i in range(n)
    ]
    history = np.tile(capital, (5, 1))  # (n_steps+1, n_agents), constant for simplicity
    return talent, capital, life_events, history


def test_gini_of_equal_distribution_is_zero():
    assert gini(np.ones(10)) == 0.0


def test_pareto_tail_exponent_returns_none_for_tiny_samples():
    assert pareto_tail_exponent(np.array([1.0, 2.0])) is None


def test_summarize_population_identifies_richest_and_most_talented():
    talent = np.array([0.5, 0.9, 0.6])
    capital = np.array([100.0, 5.0, 10.0])
    summary = summarize_population(talent, capital)
    assert summary["top_capital_agent_id"] == 0
    assert summary["max_talent_agent_id"] == 1
    assert summary["max_talent_capital"] == 5.0


def test_save_numeric_report_writes_valid_json(tmp_path):
    talent, capital, life_events, _ = _toy_population()
    path = tmp_path / "report.json"
    report = save_numeric_report(str(path), talent, capital, life_events, meta={"seed": 0})

    on_disk = json.loads(path.read_text())
    assert on_disk == report
    assert on_disk["meta"]["seed"] == 0
    assert len(on_disk["agents"]) == talent.size
    # rank 1 is the richest agent
    richest = next(a for a in on_disk["agents"] if a["rank"] == 1)
    assert richest["id"] == int(np.argmax(capital))
    assert richest["lucky_seized"] in (0, 1)


def test_save_numeric_report_works_without_life_events(tmp_path):
    talent, capital, _, _ = _toy_population()
    path = tmp_path / "report.json"
    report = save_numeric_report(str(path), talent, capital, life_events=None)
    assert all(a["lucky_seized"] == 0 and a["unlucky"] == 0 for a in report["agents"])


def test_save_interactive_report_embeds_agent_data(tmp_path):
    talent, capital, life_events, history = _toy_population()
    path = tmp_path / "report.html"
    save_interactive_report(str(path), talent, capital, life_events, history, meta={"implementation": "toy"})

    html = path.read_text(encoding="utf-8")
    assert "<title>Talent vs Luck" in html
    assert '"implementation":"toy"' in html
    assert html.count('"type":"lucky_seized"') > 0
    # every agent id should show up in the embedded data
    for i in range(talent.size):
        assert f'"id":{i},' in html
