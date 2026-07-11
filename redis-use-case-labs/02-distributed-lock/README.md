# Lab 2 — Redis as a Distributed Lock

A distributed lock lets independent processes (or threads, pods, containers)
coordinate access to a shared resource — a critical section, a piece of
external state, a "only one instance should do this" job.

The standard Redis recipe:

```
SET lock:resource <unique-token> NX PX 3000   # acquire: only if not already held
...critical section...
EVAL <check-token-then-DEL> lock:resource <token>   # release: only if still ours
```

Two details matter and this lab makes both visible:
1. **`NX`** (only set if absent) is what makes acquisition atomic — no
   check-then-set gap.
2. **The token + Lua release** is what makes release safe — a naive `DEL`
   can delete a lock some *other* worker has since acquired.

## Run it

### The race a missing lock causes

```bash
python3 lock_lab.py race --naive
python3 lock_lab.py race --safe
```

8 threads each increment a shared counter 20 times via `GET` then `SET`
(read-modify-write). Without a lock, concurrent threads read the same stale
value and overwrite each other's increments — the final count comes in
*below* the expected 160. With the lock, every cycle is serialized and the
count is exact every time.

### Why release needs a token check

```bash
python3 lock_lab.py steal
```

Walks through the textbook failure: Worker A's lock TTL expires while A is
still "working" (simulated stall), Worker B acquires the now-free lock, then
A wakes up and blindly `DEL`s the lock key — destroying B's lock, not its
own. The second half of the demo replays it with the token-checked Lua
release and shows the delete gets rejected.

## Things to try

- In `race --naive`, raise `--iterations` or `--threads` — the amount of
  "lost" increments should scale with contention.
- Shorten the lock TTL in `demo_race`'s `acquire_lock(..., ttl_ms=1000)` to
  something close to the critical section's duration and see spurious lock
  expiry reintroduce the race even in "safe" mode — this is why real
  implementations (e.g. Redlock, or a watchdog that extends the TTL) exist
  for locks held longer than expected.
- Compare this to Lab 1's stampede lock — same primitive, different job
  (protecting a cache rebuild vs. protecting a counter).
