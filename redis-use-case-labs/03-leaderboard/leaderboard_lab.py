"""
Redis for Leaderboards — sorted sets stay correctly ranked under concurrent writes.

Run:
    python3 leaderboard_lab.py basics             # add/rank/top-n/around-me
    python3 leaderboard_lab.py race                # concurrent ZINCRBY vs naive Python sort
    python3 leaderboard_lab.py race --naive-python  # show the bug the naive approach has
"""
import argparse
import random
import threading

import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

BOARD_KEY = "leaderboard:arena"


def demo_basics():
    r.delete(BOARD_KEY)

    print("Adding players with scores...")
    r.zadd(BOARD_KEY, {"Yuan": 1500, "Alex": 800, "Sam": 2200, "Taylor": 1800, "Morgan": 1200})

    print("\nTop 3 (ZREVRANGE ... WITHSCORES):")
    for rank, (player, score) in enumerate(r.zrevrange(BOARD_KEY, 0, 2, withscores=True), 1):
        print(f"  #{rank} {player}: {int(score)}")

    print("\nYuan's rank (ZREVRANK, 0-indexed -> +1):")
    rank = r.zrevrank(BOARD_KEY, "Yuan")
    print(f"  #{rank + 1}")

    print("\nScore update after a match (ZINCRBY, atomic — no read-modify-write needed):")
    new_score = r.zincrby(BOARD_KEY, 400, "Yuan")
    print(f"  Yuan: {int(new_score)} (was 1500, +400)")

    print("\nPlayers 'around' Yuan (one above, one below — ZREVRANGE by computed rank):")
    rank = r.zrevrank(BOARD_KEY, "Yuan")
    around = r.zrevrange(BOARD_KEY, max(rank - 1, 0), rank + 1, withscores=True)
    for player, score in around:
        marker = " <-- Yuan" if player == "Yuan" else ""
        print(f"  {player}: {int(score)}{marker}")

    print("\nHow many players score higher than 1000 (ZCOUNT)?")
    count = r.zcount(BOARD_KEY, 1000, "+inf")
    print(f"  {count}")

    r.delete(BOARD_KEY)


def concurrent_zincrby(player: str, updates: int):
    for _ in range(updates):
        r.zincrby(BOARD_KEY, random.choice([10, -5, 25, 50]), player)


def demo_race(naive_python: bool, players: int = 5, threads_per_player: int = 4, updates: int = 50):
    r.delete(BOARD_KEY)
    names = [f"player-{i}" for i in range(players)]
    for name in names:
        r.zadd(BOARD_KEY, {name: 1000})

    print(f"{players} players, {threads_per_player} threads each hammering {updates} score updates concurrently\n")

    if naive_python:
        print("Mode: NAIVE — read score into Python, add delta, write it back (no atomicity)")
    else:
        print("Mode: ZINCRBY — atomic increment, no read step at all")

    # Track expected totals in Python for comparison (single-threaded ground truth).
    lock = threading.Lock()
    expected = {name: 1000 for name in names}

    def tracked_worker(name):
        for _ in range(updates):
            delta = random.choice([10, -5, 25, 50])
            with lock:
                expected[name] += delta
            if naive_python:
                current = r.zscore(BOARD_KEY, name)
                r.zadd(BOARD_KEY, {name: current + delta})
            else:
                r.zincrby(BOARD_KEY, delta, name)

    threads = []
    for name in names:
        for _ in range(threads_per_player):
            threads.append(threading.Thread(target=tracked_worker, args=(name,)))
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    print(f"\n{'Player':<12} {'Expected':>10} {'Actual':>10} {'Diff':>6}")
    total_diff = 0
    for name in names:
        actual = int(r.zscore(BOARD_KEY, name))
        diff = actual - expected[name]
        total_diff += abs(diff)
        print(f"{name:<12} {expected[name]:>10} {actual:>10} {diff:>6}")

    if total_diff:
        print(f"\n^ Total drift: {total_diff}. Lost updates from concurrent GET-then-SET races.")
    else:
        print("\n^ Every score matches exactly — ZINCRBY is atomic, no lost updates.")

    r.delete(BOARD_KEY)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=["basics", "race"])
    parser.add_argument("--naive-python", action="store_true", help="use GET-then-SET instead of ZINCRBY")
    parser.add_argument("--players", type=int, default=5)
    parser.add_argument("--threads-per-player", type=int, default=4)
    parser.add_argument("--updates", type=int, default=50)
    args = parser.parse_args()

    r.ping()

    if args.mode == "basics":
        demo_basics()
    else:
        demo_race(
            naive_python=args.naive_python,
            players=args.players,
            threads_per_player=args.threads_per_player,
            updates=args.updates,
        )
