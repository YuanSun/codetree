"""
Redis as a Cache — cache-aside pattern, and the "thundering herd" it invites.

Run:
    python3 cache_lab.py hit-miss          # basic GET -> miss -> SETEX -> GET -> hit
    python3 cache_lab.py stampede          # N threads all miss the same key at once
    python3 cache_lab.py stampede --locked # same, but with a lock guarding the DB call
"""
import argparse
import threading
import time

import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

KEY_PREFIX = "cache:product:"
TTL_SECONDS = 5
DB_LATENCY_SECONDS = 0.5  # pretend the "real" database is slow

db_call_count = 0
db_call_lock = threading.Lock()


def fetch_from_database(product_id: str) -> str:
    """Stands in for a slow query / expensive computation."""
    global db_call_count
    with db_call_lock:
        db_call_count += 1
    time.sleep(DB_LATENCY_SECONDS)
    return f"product-{product_id}-payload"


def cache_aside_get(product_id: str) -> tuple[str, bool]:
    """Returns (value, was_cache_hit)."""
    key = KEY_PREFIX + product_id
    cached = r.get(key)
    if cached is not None:
        return cached, True
    value = fetch_from_database(product_id)
    r.set(key, value, ex=TTL_SECONDS)
    return value, False


def cache_aside_get_locked(product_id: str) -> tuple[str, bool]:
    """
    Same as above, but only one thread rebuilds the value on a miss.
    Others block briefly on the lock, then find the value already cached.
    """
    key = KEY_PREFIX + product_id
    lock_key = f"lock:{key}"

    cached = r.get(key)
    if cached is not None:
        return cached, True

    # SET NX with a short TTL: whoever gets the lock rebuilds the cache.
    got_lock = r.set(lock_key, "1", nx=True, ex=int(DB_LATENCY_SECONDS) + 2)
    if got_lock:
        try:
            value = fetch_from_database(product_id)
            r.set(key, value, ex=TTL_SECONDS)
            return value, False
        finally:
            r.delete(lock_key)
    else:
        # Someone else is rebuilding it — wait for them instead of hitting the DB too.
        for _ in range(50):
            time.sleep(0.05)
            cached = r.get(key)
            if cached is not None:
                return cached, True
        # Lock holder died without releasing/populating; fall back.
        value = fetch_from_database(product_id)
        return value, False


def demo_hit_miss():
    product_id = "42"
    r.delete(KEY_PREFIX + product_id)

    print(f"TTL for cached entries: {TTL_SECONDS}s\n")

    start = time.time()
    value, hit = cache_aside_get(product_id)
    print(f"1st GET -> {'HIT' if hit else 'MISS'} ({time.time() - start:.2f}s) value={value}")

    start = time.time()
    value, hit = cache_aside_get(product_id)
    print(f"2nd GET -> {'HIT' if hit else 'MISS'} ({time.time() - start:.2f}s) value={value}")

    print(f"\nWaiting {TTL_SECONDS}s for the entry to expire...")
    time.sleep(TTL_SECONDS + 0.2)

    start = time.time()
    value, hit = cache_aside_get(product_id)
    print(f"3rd GET (after TTL) -> {'HIT' if hit else 'MISS'} ({time.time() - start:.2f}s) value={value}")

    r.delete(KEY_PREFIX + product_id)


def demo_stampede(locked: bool, concurrency: int = 20):
    global db_call_count
    db_call_count = 0
    product_id = "hot-item"
    key = KEY_PREFIX + product_id
    r.delete(key, f"lock:{key}")

    get_fn = cache_aside_get_locked if locked else cache_aside_get
    print(f"{concurrency} threads request the same *uncached* key simultaneously")
    print(f"(mode: {'lock-guarded' if locked else 'naive'} cache-aside)\n")

    results = []

    def worker(i):
        start = time.time()
        _, hit = get_fn(product_id)
        results.append((i, hit, time.time() - start))

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(concurrency)]
    overall_start = time.time()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    elapsed = time.time() - overall_start

    hits = sum(1 for _, hit, _ in results if hit)
    misses = concurrency - hits
    print(f"Completed in {elapsed:.2f}s | cache hits: {hits} | cache misses: {misses}")
    print(f"Database was actually called {db_call_count} time(s).")
    if not locked and db_call_count > 1:
        print(
            "\n^ This is a cache stampede: every thread saw a miss before anyone "
            "finished populating the cache, so they *all* hit the database.\n"
            "  Re-run with --locked to see the fix."
        )
    elif locked:
        print(f"\n^ Only the first thread hit the database; the other {concurrency - 1} waited for it.")

    r.delete(key, f"lock:{key}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=["hit-miss", "stampede"])
    parser.add_argument("--locked", action="store_true", help="use the lock-guarded cache-aside variant")
    parser.add_argument("--concurrency", type=int, default=20)
    args = parser.parse_args()

    r.ping()

    if args.mode == "hit-miss":
        demo_hit_miss()
    else:
        demo_stampede(locked=args.locked, concurrency=args.concurrency)
