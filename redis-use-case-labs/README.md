# Redis Use-Case Labs

Six small, self-contained labs, each isolating one classic Redis pattern so you can
run it, break it, and watch it fail before fixing it. Companion to `../keda-redis-lab`
(which covers Redis as a KEDA autoscaling trigger) and `../redis-playground`
(one-shot command cheatsheets) — these labs focus on **concurrency and failure modes**:
what goes wrong with a naive implementation, and why the "boring" Redis-native
approach (Lua scripts, atomic commands, streams) is the fix.

| # | Lab | Redis feature | Concept demonstrated |
|---|-----|----------------|----------------------|
| 1 | [Cache](./01-cache) | `SET EX`, `GET` | Cache-aside pattern, cache stampede, and the lock-based fix |
| 2 | [Distributed Lock](./02-distributed-lock) | `SET NX PX`, Lua | Mutual exclusion across processes, why naive locks corrupt data |
| 3 | [Leaderboards](./03-leaderboard) | Sorted Sets (`ZADD`/`ZINCRBY`/`ZRANGE`) | Atomic ranked updates under concurrent writers |
| 4 | [Rate Limiting](./04-rate-limiting) | `INCR`+`EXPIRE`, Sorted Sets, Lua | Fixed window vs. sliding window vs. token bucket |
| 5 | [Event Sourcing](./05-event-sourcing) | Streams (`XADD`/`XREADGROUP`/`XACK`) | Rebuilding state by replaying an immutable event log |
| 6 | [Pub/Sub](./06-pubsub) | `PUBLISH`/`SUBSCRIBE` | Fire-and-forget messaging, and why it's not durable (contrast with #5) |

## Quick Start

```bash
# 1. Start Redis + a web UI to inspect keys (http://localhost:8081)
docker compose up -d

# 2. Install the Python client
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 3. Jump into any lab
cd 01-cache && python3 cache_lab.py --help
```

Every lab connects to `localhost:6379` and cleans up its own keys on exit
(prefixed so they're easy to spot in Redis Commander, e.g. `cache:`, `lock:`,
`leaderboard:`, `ratelimit:`, `events:`, `chat:`).

Tear down with `docker compose down` when you're done.

## Suggested order

Run them in order 1 → 6. Locks (#2) show up again inside the cache stampede fix
in #1; sorted sets (#3) reappear as the sliding-window log in #4; streams (#5)
are the durable answer to the message-loss problem you'll see in Pub/Sub (#6).
