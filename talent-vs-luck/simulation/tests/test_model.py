import numpy as np

from simulation.model import SimulationConfig, run_simulation
from simulation.stats import gini, summarize


def test_talent_is_gaussian_and_bounded():
    config = SimulationConfig(n_agents=5000, seed=1)
    result = run_simulation(config)
    assert result.talent.min() >= 0.0
    assert result.talent.max() <= 1.0
    assert abs(result.talent.mean() - config.talent_mean) < 0.02


def test_wealth_ends_up_far_more_unequal_than_talent():
    config = SimulationConfig(n_agents=2000, seed=2)
    result = run_simulation(config)
    stats = summarize(result)
    assert stats["gini_capital"] > stats["gini_talent"] + 0.2


def test_richest_agent_is_not_the_most_talented():
    config = SimulationConfig(n_agents=2000, seed=2)
    result = run_simulation(config)
    top_capital_idx = int(np.argmax(result.capital))
    max_talent_idx = int(np.argmax(result.talent))
    assert top_capital_idx != max_talent_idx


def test_simulation_is_deterministic_given_a_seed():
    config = SimulationConfig(n_agents=200, seed=42)
    r1 = run_simulation(config)
    r2 = run_simulation(config)
    np.testing.assert_array_equal(r1.capital, r2.capital)
    np.testing.assert_array_equal(r1.talent, r2.talent)


def test_capital_history_shape():
    config = SimulationConfig(n_agents=50, n_steps=10, seed=3)
    result = run_simulation(config)
    assert result.capital_history.shape == (11, 50)
    np.testing.assert_array_equal(result.capital_history[-1], result.capital)


def test_gini_of_equal_distribution_is_zero():
    assert gini(np.ones(10)) == 0.0


def test_gini_of_all_to_one_agent_approaches_one():
    values = np.zeros(100)
    values[0] = 1.0
    assert gini(values) > 0.95


def test_life_events_counts_match_lucky_and_unlucky_totals():
    config = SimulationConfig(n_agents=300, seed=4)
    result = run_simulation(config)
    for i, events in enumerate(result.life_events):
        seized = sum(1 for e in events if e["type"] == "lucky_seized")
        unlucky = sum(1 for e in events if e["type"] == "unlucky")
        assert seized == result.lucky_events[i]
        assert unlucky == result.unlucky_events[i]


def test_life_events_are_chronological_and_replay_to_final_capital():
    config = SimulationConfig(n_agents=300, seed=4)
    result = run_simulation(config)
    for i, events in enumerate(result.life_events):
        steps = [e["step"] for e in events]
        assert steps == sorted(steps)
        if events:
            assert events[-1]["capital_after"] == result.capital[i]
        for e in events:
            assert 1 <= e["step"] <= config.n_steps
            if e["type"] == "lucky_missed":
                assert e["capital_before"] == e["capital_after"]


def test_lucky_missed_events_are_recorded_for_low_talent_agents():
    # A zero-talent agent can never seize a lucky event -- every lucky
    # encounter it has must show up as "lucky_missed".
    config = SimulationConfig(n_agents=50, talent_mean=0.0, talent_std=0.0, event_rate=0.9, seed=5)
    result = run_simulation(config)
    assert any(e["type"] == "lucky_missed" for events in result.life_events for e in events)
    assert not any(e["type"] == "lucky_seized" for events in result.life_events for e in events)
