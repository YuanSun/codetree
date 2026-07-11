# Lab 3 — Redis for Leaderboards

Sorted sets (`ZADD`, `ZINCRBY`, `ZRANGE`/`ZREVRANGE`, `ZRANK`/`ZREVRANK`) keep
members ordered by score with `O(log N)` inserts and range queries — exactly
the shape of a leaderboard: top-N, "my rank", "players around me."

## Run it

```bash
python3 leaderboard_lab.py basics
```

Walks through the core operations: adding scores, top-3, a player's rank,
an atomic score bump after a match (`ZINCRBY`), the players ranked around a
given player, and a threshold count (`ZCOUNT`).

## Concurrency: why `ZINCRBY` beats read-modify-write

```bash
python3 leaderboard_lab.py race                  # atomic ZINCRBY
python3 leaderboard_lab.py race --naive-python    # ZSCORE, add in Python, ZADD back
```

Each of 5 players gets hammered by 4 threads applying 50 random score deltas
concurrently (200 updates per player). A single-threaded Python dict tracks
what the *correct* final score should be.

- `ZINCRBY` mode: every player's actual score matches the expected total exactly.
- `--naive-python` mode: two threads can read the same score before either
  writes back, so one update silently overwrites the other — the printed
  diff table shows real players finishing with the wrong score.

## Things to try

- Increase `--threads-per-player` in naive mode and watch the drift grow.
- Add a `ZADD ... GT` (Redis 6.2+, only update if the new score is greater) to
  build a "personal best" leaderboard variant, and check it works correctly
  even in the naive-write path.
- Use `ZRANGEBYSCORE` to implement tiers/brackets (e.g. bronze/silver/gold
  cutoffs) on top of the same key.
