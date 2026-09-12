import json

import numpy as np

from common.report import _histogram, save_interactive_report, save_numeric_report
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


def test_summarize_population_includes_talent_and_capital_moments():
    talent = np.array([0.4, 0.5, 0.6, 0.7])
    capital = np.array([10.0, 20.0, 30.0, 40.0])
    summary = summarize_population(talent, capital)
    assert summary["mean_talent"] == talent.mean()
    assert summary["std_talent"] == talent.std()
    assert summary["std_capital"] == capital.std()


def test_histogram_linear_bins_cover_the_full_range_and_counts_sum_to_n():
    values = np.array([0.1, 0.2, 0.2, 0.5, 0.9])
    hist = _histogram(values, bins=4, log=False)
    assert hist["log"] is False
    assert len(hist["edges"]) == 5
    assert hist["edges"][0] <= values.min()
    assert hist["edges"][-1] >= values.max()
    assert sum(hist["counts"]) == values.size


def test_histogram_log_bins_ignore_non_positive_values():
    values = np.array([0.0, -5.0, 1.0, 10.0, 100.0])
    hist = _histogram(values, bins=10, log=True)
    assert hist["log"] is True
    assert sum(hist["counts"]) == 3  # only the strictly-positive values


def test_histogram_clip_percentile_still_counts_every_value():
    # A population clustered around 10, plus one extreme outlier -- the
    # kind of shape that comes out of the multiplicative capital model.
    values = np.concatenate([np.full(199, 10.0), [7e-11]])
    hist = _histogram(values, bins=30, log=True, clip_percentile=1.0)
    assert sum(hist["counts"]) == values.size
    assert hist["edges"][0] <= values.min()
    assert hist["edges"][-1] >= values.max()


def test_histogram_clip_percentile_gives_the_bulk_of_the_data_more_resolution():
    # Without clipping, the single outlier stretches nearly every bin
    # edge down toward it, leaving almost no resolution around the
    # cluster at 10. With clipping, most of the inner bins should sit
    # close to where the data actually is.
    values = np.concatenate([np.full(199, 10.0), [7e-11]])
    unclipped = _histogram(values, bins=30, log=True, clip_percentile=0.0)
    clipped = _histogram(values, bins=30, log=True, clip_percentile=1.0)
    # the first "real" edge after the outlier-catching bin should be much
    # closer to 10 when clipped than when not
    assert clipped["edges"][1] > unclipped["edges"][1]


def test_histogram_handles_constant_input_without_crashing():
    hist = _histogram(np.full(5, 3.0), bins=5, log=False)
    assert sum(hist["counts"]) == 5


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
    assert '"talent_histogram"' in html
    assert '"capital_histogram"' in html
    assert 'id="talent-chart"' in html
    assert 'id="capital-chart"' in html
