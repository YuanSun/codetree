#!/usr/bin/env python3
"""Push order jobs onto a Redis list to build up backlog for KEDA to react to.

Run as a one-shot Kubernetes Job (see apps/producer/job.yaml). Re-run it
any time to add more backlog to the queue.
"""
import json
import os
import time
import uuid

import redis

REDIS_HOST = os.environ.get("REDIS_HOST", "redis-master.redis.svc.cluster.local")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
QUEUE_KEY = os.environ.get("QUEUE_KEY", "orders-queue")
NUM_JOBS = int(os.environ.get("NUM_JOBS", "20000"))
BATCH_SIZE = 500


def main():
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    r.ping()

    print(f"Producing {NUM_JOBS} jobs onto list '{QUEUE_KEY}'...")
    pipe = r.pipeline()
    for i in range(NUM_JOBS):
        payload = json.dumps({"id": str(uuid.uuid4()), "seq": i, "ts": time.time()})
        pipe.rpush(QUEUE_KEY, payload)
        if (i + 1) % BATCH_SIZE == 0:
            pipe.execute()
    pipe.execute()

    print(f"Done producing. Queue length now: {r.llen(QUEUE_KEY)}")


if __name__ == "__main__":
    main()
