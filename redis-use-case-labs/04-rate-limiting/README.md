# Lab 4 — Redis for Rate Limiting

Three algorithms, all built on Redis primitives, all with different tradeoffs.
Limit used throughout: **5 requests per 4 seconds**.

| Algorithm | Redis structure | Weakness | Strength |
|---|---|---|---|
| Fixed window | `INCR` + `EXPIRE` | allows up to 2x burst across a window boundary | O(1), one command |
| Sliding window log | Sorted set of timestamps + Lua | more memory (one entry per request) | exact, no boundary burst |
| Token bucket | Hash (`tokens`, `updated_at`) + Lua | needs a small script | smooths bursts, models "capacity + steady refill" naturally |

## Run it

```bash
python3 rate_limit_lab.py fixed-window
python3 rate_limit_lab.py sliding-window
python3 rate_limit_lab.py token-bucket
python3 rate_limit_lab.py compare        # runs the same burst through all three back-to-back
```

Each sends 12 simulated requests, 0.15s apart, and prints ALLOWED/BLOCKED
per request plus the algorithm's internal counter.

## The boundary-burst bug, made visible

```bash
python3 rate_limit_lab.py fixed-window --delay 0.9
```

With a ~0.9s delay, requests land near the edge of a 4s window. Watch the
count reset mid-run — a client can send 5 requests right before a window
flips and 5 more right after, getting 10 requests through in under a second
even though the limit is "5 per 4s." Compare against:

```bash
python3 rate_limit_lab.py sliding-window --delay 0.9
```

Same timing, no boundary loophole — the sliding window always looks back
exactly 4 real seconds from *now*, regardless of clock alignment.

## Things to try

- In `token-bucket`, raise `--requests` past the bucket capacity (5) and
  watch `tokens_left` bottom out at 0 then climb back up between requests
  as it refills at `capacity / WINDOW_SECONDS` tokens/sec.
- Change `refill_rate` to allow a sustained rate different from the burst
  capacity (e.g. capacity=20, refill_rate=2/s) — this is how token buckets
  model "allow occasional bursts, but average out over time."
- Point two different `user` values at the same script and confirm limits
  are tracked independently (each key is scoped to the user).
