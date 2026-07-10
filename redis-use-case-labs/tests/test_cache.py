import threading
import time


def test_cache_aside_populates_then_hits(cache_lab):
    key = cache_lab.KEY_PREFIX + "test-product"
    cache_lab.r.delete(key)

    value1, hit1 = cache_lab.cache_aside_get("test-product")
    assert hit1 is False

    value2, hit2 = cache_lab.cache_aside_get("test-product")
    assert hit2 is True
    assert value2 == value1

    cache_lab.r.delete(key)


def test_cache_aside_expires_after_ttl(cache_lab, monkeypatch):
    monkeypatch.setattr(cache_lab, "TTL_SECONDS", 1)
    key = cache_lab.KEY_PREFIX + "short-lived"
    cache_lab.r.delete(key)

    _, hit1 = cache_lab.cache_aside_get("short-lived")
    assert hit1 is False

    time.sleep(1.2)

    _, hit2 = cache_lab.cache_aside_get("short-lived")
    assert hit2 is False  # TTL lapsed, so this is a second miss, not a hit

    cache_lab.r.delete(key)


def test_naive_cache_aside_stampedes_under_concurrency(cache_lab):
    key = cache_lab.KEY_PREFIX + "hot-item"
    cache_lab.r.delete(key)
    cache_lab.db_call_count = 0

    threads = [threading.Thread(target=cache_lab.cache_aside_get, args=("hot-item",)) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert cache_lab.db_call_count > 1  # the bug: every concurrent miss re-hits the "DB"

    cache_lab.r.delete(key)


def test_locked_cache_aside_prevents_stampede(cache_lab):
    key = cache_lab.KEY_PREFIX + "hot-item-locked"
    lock_key = f"lock:{key}"
    cache_lab.r.delete(key, lock_key)
    cache_lab.db_call_count = 0

    threads = [threading.Thread(target=cache_lab.cache_aside_get_locked, args=("hot-item-locked",)) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert cache_lab.db_call_count == 1  # the fix: only the lock-holder rebuilds

    cache_lab.r.delete(key, lock_key)
