import numpy as np

from spatial_sim.world import World


def make_world(**overrides):
    defaults = dict(n_agents=50, n_lucky=20, n_unlucky=20, grid_size=21, seed=1)
    defaults.update(overrides)
    return World(**defaults)


def test_particle_positions_stay_on_grid_after_many_steps():
    world = make_world()
    for _ in range(30):
        world.step()
    assert (world.lucky_pos >= 0).all() and (world.lucky_pos < world.grid_size).all()
    assert (world.unlucky_pos >= 0).all() and (world.unlucky_pos < world.grid_size).all()


def test_agents_never_move():
    world = make_world()
    original = world.agent_pos.copy()
    for _ in range(10):
        world.step()
    np.testing.assert_array_equal(world.agent_pos, original)


def test_direct_hit_from_unlucky_particle_always_halves_capital():
    world = make_world(collision_radius=0.5, n_unlucky=50, n_lucky=0)
    world.unlucky_pos[:] = world.agent_pos.copy()  # force an exact hit on every agent
    before = world.capital.copy()
    world.apply_collisions()
    np.testing.assert_array_equal(world.capital, before * 0.5)
    assert (world.unlucky_events == 1).all()


def test_direct_hit_from_lucky_particle_only_pays_off_for_high_talent():
    world = make_world(collision_radius=0.5, n_lucky=50, n_unlucky=0)
    world.talent[:] = 1.0  # guaranteed to seize the opportunity
    world.lucky_pos[:] = world.agent_pos.copy()
    before = world.capital.copy()
    world.apply_collisions()
    np.testing.assert_array_equal(world.capital, before * 2.0)
    assert (world.lucky_events == 1).all()


def test_no_particles_nearby_leaves_capital_unchanged():
    world = make_world(n_lucky=0, n_unlucky=0)
    before = world.capital.copy()
    world.step()
    np.testing.assert_array_equal(world.capital, before)


def test_capital_stays_non_negative_over_a_full_career():
    world = make_world()
    for _ in range(80):
        world.step()
    assert (world.capital >= 0).all()


def test_deterministic_with_a_fixed_seed():
    w1 = make_world(seed=7)
    w2 = make_world(seed=7)
    for _ in range(15):
        w1.step()
        w2.step()
    np.testing.assert_array_equal(w1.capital, w2.capital)
    np.testing.assert_array_equal(w1.lucky_pos, w2.lucky_pos)
