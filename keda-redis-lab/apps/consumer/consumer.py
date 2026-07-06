#!/usr/bin/env python3
"""Long-running worker that drains jobs from a Redis list.

KEDA scales this Deployment in and out based on the length of QUEUE_KEY
(see keda/scaled-object.yaml), so each pod just needs to keep draining the
list and exit cleanly when asked to stop.
"""
import json
import os
import signal
import sys
import time

import redis

REDIS_HOST = os.environ.get("REDIS_HOST", "redis-master.redis.svc.cluster.local")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
QUEUE_KEY = os.environ.get("QUEUE_KEY", "orders-queue")
PROCESS_SECONDS = float(os.environ.get("PROCESS_SECONDS", "0.05"))

running = True


def _stop(signum, _frame):
    global running
    print(f"received signal {signum}, shutting down after current job...", flush=True)
    running = False


signal.signal(signal.SIGTERM, _stop)
signal.signal(signal.SIGINT, _stop)


def main():
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    r.ping()

    pod = os.environ.get("HOSTNAME", "worker")
    print(f"[{pod}] worker started, watching '{QUEUE_KEY}'", flush=True)

    processed = 0
    while running:
        item = r.blpop(QUEUE_KEY, timeout=5)
        if item is None:
            continue
        _, payload = item
        job = json.loads(payload)
        time.sleep(PROCESS_SECONDS)
        processed += 1
        if processed % 100 == 0:
            print(f"[{pod}] processed {processed} jobs (last seq={job['seq']})", flush=True)

    print(f"[{pod}] exiting, processed {processed} jobs total", flush=True)
    sys.exit(0)


if __name__ == "__main__":
    main()
