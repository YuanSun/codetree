"""
Redis as a Distributed Lock — mutual exclusion across processes/threads.

Run:
    python3 lock_lab.py race --naive     # no locking: shared counter gets corrupted
    python3 lock_lab.py race --safe      # SET NX PX + token-checked release: correct
    python3 lock_lab.py steal            # demonstrates why a naive DEL-based release
                                          # can release someone else's lock
"""
import argparse
import threading
import time
import uuid

import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

COUNTER_KEY = "lock:demo:counter"
LOCK_KEY = "lock:demo:resource"

# Only delete the lock if the value still matches our token (Lua = atomic check-and-delete).
_RELEASE_SCRIPT = """
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
"""
release_lock_script = r.register_script(_RELEASE_SCRIPT)


def acquire_lock(name: str, ttl_ms: int = 3000) -> str | None:
    """Returns a unique token if acquired, else None."""
    token = str(uuid.uuid4())
    acquired = r.set(name, token, nx=True, px=ttl_ms)
    return token if acquired else None


def release_lock(name: str, token: str) -> bool:
    return bool(release_lock_script(keys=[name], args=[token]))


def naive_increment(iterations: int):
    """Read-modify-write with NO locking — classic lost-update race."""
    for _ in range(iterations):
        current = int(r.get(COUNTER_KEY) or 0)
        time.sleep(0.001)  # widen the race window so it's reliably visible
        r.set(COUNTER_KEY, current + 1)


def safe_increment(iterations: int):
    """Same read-modify-write, guarded by a distributed lock."""
    for _ in range(iterations):
        token = None
        while token is None:
            token = acquire_lock(LOCK_KEY, ttl_ms=1000)
            if token is None:
                time.sleep(0.001)
        try:
            current = int(r.get(COUNTER_KEY) or 0)
            time.sleep(0.001)
            r.set(COUNTER_KEY, current + 1)
        finally:
            release_lock(LOCK_KEY, token)


def demo_race(safe: bool, threads_n: int = 8, iterations: int = 20):
    r.delete(COUNTER_KEY, LOCK_KEY)
    expected = threads_n * iterations
    fn = safe_increment if safe else naive_increment

    print(f"{threads_n} threads each increment a shared counter {iterations} times")
    print(f"Expected final value: {expected}  (mode: {'safe (locked)' if safe else 'naive (no lock)'})\n")

    threads = [threading.Thread(target=fn, args=(iterations,)) for _ in range(threads_n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    actual = int(r.get(COUNTER_KEY) or 0)
    print(f"Actual final value:   {actual}")
    if actual != expected:
        lost = expected - actual
        print(f"\n^ Lost {lost} increments to a race condition (concurrent GET-then-SET, no isolation).")
    else:
        print("\n^ Correct. The lock serialized every read-modify-write cycle.")

    r.delete(COUNTER_KEY, LOCK_KEY)


def demo_steal():
    """
    Shows why 'release = DEL' (without checking ownership) is unsafe:
    a slow worker can delete a lock it no longer holds, freeing the
    resource for a *different* worker while both think they're safe.
    """
    r.delete(LOCK_KEY)

    print("Worker A acquires the lock with a 1s TTL, then gets stuck for 1.5s (GC pause, slow I/O, etc.)")
    token_a = acquire_lock(LOCK_KEY, ttl_ms=1000)
    print(f"  Worker A token: {token_a}")

    print("\n...Worker A is stalled. Meanwhile the lock expires, and Worker B acquires it...")
    time.sleep(1.2)
    token_b = acquire_lock(LOCK_KEY, ttl_ms=1000)
    print(f"  Worker B token: {token_b}  (acquired because A's TTL lapsed)")

    print("\nWorker A wakes up and calls a NAIVE release (plain DEL, no token check):")
    r.delete(LOCK_KEY)
    still_locked = r.get(LOCK_KEY)
    print(f"  Lock key after naive DEL: {still_locked!r}")
    print("  ^ Worker A just deleted Worker B's lock! Both A and B now believe they hold it.")

    print("\nNow replay it with the token-checked release script:")
    token_a2 = acquire_lock(LOCK_KEY, ttl_ms=1000)
    token_b2 = acquire_lock(LOCK_KEY, ttl_ms=1000)  # fails, A still holds it
    print(f"  A holds the lock (token={token_a2}); B's acquire attempt: {'granted' if token_b2 else 'DENIED (correct)'}")
    result = release_lock_script(keys=[LOCK_KEY], args=["not-a-real-token"])
    print(f"  Someone else tries to release with the wrong token -> {'released' if result else 'REJECTED (correct)'}")
    release_lock(LOCK_KEY, token_a2)
    print("  A releases with its real token -> released")

    r.delete(LOCK_KEY)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=["race", "steal"])
    parser.add_argument("--naive", action="store_true")
    parser.add_argument("--safe", action="store_true")
    parser.add_argument("--threads", type=int, default=8)
    parser.add_argument("--iterations", type=int, default=20)
    args = parser.parse_args()

    r.ping()

    if args.mode == "race":
        if args.naive == args.safe:
            parser.error("pass exactly one of --naive or --safe")
        demo_race(safe=args.safe, threads_n=args.threads, iterations=args.iterations)
    else:
        demo_steal()
