import time


def test_fixed_window_blocks_after_limit(rate_limit_lab):
    user = "test:user:fixed"
    rate_limit_lab._cleanup(user)

    results = [rate_limit_lab.fixed_window_allow(user)["allowed"] for _ in range(rate_limit_lab.LIMIT + 3)]

    assert results[: rate_limit_lab.LIMIT] == [True] * rate_limit_lab.LIMIT
    assert all(allowed is False for allowed in results[rate_limit_lab.LIMIT:])

    rate_limit_lab._cleanup(user)


def test_sliding_window_blocks_after_limit(rate_limit_lab):
    user = "test:user:sliding"
    rate_limit_lab._cleanup(user)

    results = [rate_limit_lab.sliding_window_allow(user)["allowed"] for _ in range(rate_limit_lab.LIMIT + 3)]

    assert results[: rate_limit_lab.LIMIT] == [True] * rate_limit_lab.LIMIT
    assert all(allowed is False for allowed in results[rate_limit_lab.LIMIT:])

    rate_limit_lab._cleanup(user)


def test_sliding_window_recovers_once_old_entries_age_out(rate_limit_lab):
    user = "test:user:sliding-recover"
    rate_limit_lab._cleanup(user)

    for _ in range(rate_limit_lab.LIMIT):
        assert rate_limit_lab.sliding_window_allow(user)["allowed"] is True
    assert rate_limit_lab.sliding_window_allow(user)["allowed"] is False

    time.sleep(rate_limit_lab.WINDOW_SECONDS + 0.5)
    assert rate_limit_lab.sliding_window_allow(user)["allowed"] is True

    rate_limit_lab._cleanup(user)


def test_token_bucket_refills_over_time(rate_limit_lab):
    user = "test:user:bucket"
    rate_limit_lab._cleanup(user)

    for _ in range(rate_limit_lab.LIMIT):
        assert rate_limit_lab.token_bucket_allow(user)["allowed"] is True
    assert rate_limit_lab.token_bucket_allow(user)["allowed"] is False

    time.sleep(rate_limit_lab.WINDOW_SECONDS + 0.5)
    assert rate_limit_lab.token_bucket_allow(user)["allowed"] is True

    rate_limit_lab._cleanup(user)
