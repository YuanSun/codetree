import redis

r = redis.Redis(host='localhost', port=6379, decode_responses=True)


def acquire_lock(lock_name: str, holder: str, ttl: int = 10) -> bool:
    key = f"lock:{lock_name}"
    return r.set(key, holder, nx=True, ex=ttl) is not None


def release_lock(lock_name: str, holder: str) -> bool:
    key = f"lock:{lock_name}"
    if r.get(key) == holder:
        r.delete(key)
        return True
    return False


def lock_status(lock_name: str) -> dict:
    key = f"lock:{lock_name}"
    holder = r.get(key)
    return {"is_locked": holder is not None, "holder": holder, "ttl": r.ttl(key)}


print("--- Distributed Lock ---")
LOCK = "critical-resource"
print(f"\nResource: '{LOCK}'")

acquired = acquire_lock(LOCK, "worker-1", ttl=30)
print(f"\nWorker-1 acquires lock: {'SUCCESS' if acquired else 'FAILED'}")
status = lock_status(LOCK)
print(f"Status: held by '{status['holder']}', TTL={status['ttl']}s")

acquired2 = acquire_lock(LOCK, "worker-2", ttl=30)
print(f"\nWorker-2 tries same lock: {'SUCCESS' if acquired2 else 'FAILED - lock already held by worker-1'}")

released = release_lock(LOCK, "worker-1")
print(f"\nWorker-1 releases lock: {'SUCCESS' if released else 'FAILED'}")

acquired3 = acquire_lock(LOCK, "worker-2", ttl=30)
print(f"Worker-2 tries again after release: {'SUCCESS' if acquired3 else 'FAILED'}")
status = lock_status(LOCK)
print(f"Status: held by '{status['holder']}', TTL={status['ttl']}s")

release_lock(LOCK, "worker-2")
print("\nCleaned up Redis keys.")
