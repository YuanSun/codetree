# Lab 1 — Redis as a Cache

The **cache-aside** (a.k.a. lazy-loading) pattern: on read, check Redis first;
on miss, fetch from the "real" source (a database, an API, an expensive
computation), then populate Redis with a TTL so it expires automatically.

```
GET cache:product:42          -> miss
<slow database call>
SETEX cache:product:42 5 ...  -> populate with a 5s TTL
GET cache:product:42          -> hit, no DB call
```

## Run it

```bash
python3 cache_lab.py hit-miss
```

Watch the first request take ~0.5s (simulated DB latency) and the second
return instantly from Redis. Wait out the TTL and it falls back to the slow
path again.

## The stampede problem

Cache-aside has a classic failure mode: if a **popular** key expires (or
never existed) and many requests arrive at once, *every one of them* sees a
miss and hits the database simultaneously — the exact load spike the cache
was supposed to prevent.

```bash
python3 cache_lab.py stampede
```

Expected output: 20 threads, but the "database" gets called ~20 times too —
the cache provided zero protection for that window.

## The fix: a lock around the rebuild

```bash
python3 cache_lab.py stampede --locked
```

Now only the first thread to miss acquires a short-lived lock (`SET NX EX`,
the same primitive as Lab 2) and rebuilds the cache; the rest poll briefly
and pick up the value the first thread wrote. Database calls drop to 1.

## Things to try

- Lower `DB_LATENCY_SECONDS` to 0 — does the stampede still happen? (Race
  windows shrink but don't disappear; try raising `--concurrency`.)
- Watch keys live in Redis Commander (http://localhost:8081) while running
  `hit-miss` and note the TTL counting down.
- What happens if the lock holder crashes mid-rebuild (kill `-9` the
  process)? The lock's own TTL is what saves you — remove it and lock-out
  becomes permanent.
