#!/usr/bin/env bash
# Runs every lab's non-interactive demo in sequence, so you can see all six
# patterns in action without reading each README first. Pub/Sub's interactive
# subscribe/publish commands are skipped — run those yourself in two terminals.
set -euo pipefail
cd "$(dirname "$0")/.."

section() {
	echo
	echo "=================================================================="
	echo "  $1"
	echo "=================================================================="
}

section "1/6 Cache — hit/miss, then a stampede vs. the lock-guarded fix"
python3 01-cache/cache_lab.py hit-miss
python3 01-cache/cache_lab.py stampede
python3 01-cache/cache_lab.py stampede --locked

section "2/6 Distributed Lock — naive race vs. safe, then lock theft"
python3 02-distributed-lock/lock_lab.py race --naive
python3 02-distributed-lock/lock_lab.py race --safe
python3 02-distributed-lock/lock_lab.py steal

section "3/6 Leaderboard — basics, then ZINCRBY vs. naive under concurrency"
python3 03-leaderboard/leaderboard_lab.py basics
python3 03-leaderboard/leaderboard_lab.py race
python3 03-leaderboard/leaderboard_lab.py race --naive-python

section "4/6 Rate Limiting — fixed window, sliding window, token bucket"
python3 04-rate-limiting/rate_limit_lab.py compare

section "5/6 Event Sourcing — append, replay, consumer groups"
python3 05-event-sourcing/event_sourcing_lab.py append
python3 05-event-sourcing/event_sourcing_lab.py replay
python3 05-event-sourcing/event_sourcing_lab.py consumer-group

section "6/6 Pub/Sub — message loss and pattern subscriptions"
python3 06-pubsub/pubsub_lab.py loss-demo
python3 06-pubsub/pubsub_lab.py pattern-demo

echo
echo "Tour complete. Try the interactive Pub/Sub demo yourself:"
echo "  python3 06-pubsub/pubsub_lab.py subscribe --channel chat:general"
echo "  python3 06-pubsub/pubsub_lab.py publish   --channel chat:general"
