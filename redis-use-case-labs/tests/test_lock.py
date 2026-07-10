import threading


def test_acquire_lock_is_mutually_exclusive(lock_lab):
    name = "test:lock:mutex"
    lock_lab.r.delete(name)

    token1 = lock_lab.acquire_lock(name, ttl_ms=5000)
    assert token1 is not None

    token2 = lock_lab.acquire_lock(name, ttl_ms=5000)
    assert token2 is None  # already held, second acquire must fail

    lock_lab.release_lock(name, token1)
    lock_lab.r.delete(name)


def test_release_requires_matching_token(lock_lab):
    name = "test:lock:token-check"
    lock_lab.r.delete(name)
    token = lock_lab.acquire_lock(name, ttl_ms=5000)

    released_with_wrong_token = lock_lab.release_lock(name, "not-the-real-token")
    assert released_with_wrong_token is False
    assert lock_lab.r.get(name) == token  # still held — wrong-token release must be rejected

    released_with_right_token = lock_lab.release_lock(name, token)
    assert released_with_right_token is True
    assert lock_lab.r.get(name) is None

    lock_lab.r.delete(name)


def test_safe_increment_has_no_lost_updates(lock_lab):
    lock_lab.r.delete(lock_lab.COUNTER_KEY, lock_lab.LOCK_KEY)
    threads_n, iterations = 6, 10

    threads = [threading.Thread(target=lock_lab.safe_increment, args=(iterations,)) for _ in range(threads_n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert int(lock_lab.r.get(lock_lab.COUNTER_KEY)) == threads_n * iterations

    lock_lab.r.delete(lock_lab.COUNTER_KEY, lock_lab.LOCK_KEY)


def test_naive_increment_loses_updates_under_concurrency(lock_lab):
    lock_lab.r.delete(lock_lab.COUNTER_KEY)
    threads_n, iterations = 6, 10
    expected = threads_n * iterations

    threads = [threading.Thread(target=lock_lab.naive_increment, args=(iterations,)) for _ in range(threads_n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    actual = int(lock_lab.r.get(lock_lab.COUNTER_KEY))
    assert actual < expected  # the bug: concurrent read-modify-write drops increments

    lock_lab.r.delete(lock_lab.COUNTER_KEY)
