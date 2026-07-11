"""
Redis for Event Sourcing — an append-only log (Streams) as the source of
truth, with state rebuilt by replaying events rather than stored directly.

Run:
    python3 event_sourcing_lab.py append       # record events for a bank account
    python3 event_sourcing_lab.py replay        # rebuild balance from the raw log
    python3 event_sourcing_lab.py consumer-group  # reliable processing + crash recovery
"""
import argparse
import time

import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

STREAM_KEY = "events:account:acct-1"
GROUP_NAME = "balance-projectors"


def emit(event_type: str, **fields):
    payload = {"type": event_type, **{k: str(v) for k, v in fields.items()}}
    event_id = r.xadd(STREAM_KEY, payload)
    print(f"  appended {event_id}: {payload}")
    return event_id


def demo_append():
    r.delete(STREAM_KEY)
    print(f"Appending events to stream '{STREAM_KEY}' (an immutable, ordered log):\n")
    emit("AccountOpened", owner="Yuan", opening_balance=0)
    emit("Deposited", amount=500)
    emit("Deposited", amount=250)
    emit("Withdrawn", amount=100)
    emit("Deposited", amount=1000)
    emit("Withdrawn", amount=300)
    print(f"\nStream length (XLEN): {r.xlen(STREAM_KEY)}")
    print("Nothing here is 'the balance' — it's the sequence of facts that produced it.")


def rebuild_balance() -> tuple[int, list]:
    """The whole point of event sourcing: current state = fold(events)."""
    events = r.xrange(STREAM_KEY)
    balance = 0
    history = []
    for event_id, fields in events:
        etype = fields["type"]
        if etype == "Deposited":
            balance += int(fields["amount"])
        elif etype == "Withdrawn":
            balance -= int(fields["amount"])
        history.append((event_id, etype, balance))
    return balance, history


def demo_replay():
    if not r.exists(STREAM_KEY):
        print("No stream found — run 'append' first.")
        return

    print("Replaying the entire event log to derive the current balance:\n")
    balance, history = rebuild_balance()
    for event_id, etype, running_balance in history:
        print(f"  {event_id}  {etype:<14} -> balance = {running_balance}")

    print(f"\nFinal balance (derived, never stored directly): {balance}")

    print("\nThis is the core event-sourcing property: the log is the source of")
    print("truth. You can always recompute state, add new projections later")
    print("(e.g. 'total deposited this month') by replaying the same events,")
    print("and get a full audit trail for free.")


def demo_consumer_group():
    """
    Consumer groups give you 'at-least-once, tracked' processing: each
    message is delivered to exactly one consumer in the group, must be
    XACK'd, and stays PENDING (visible via XPENDING) until it is — so a
    crashed consumer's unacked work is recoverable, unlike Pub/Sub (Lab 6).
    """
    r.delete(STREAM_KEY)
    try:
        r.xgroup_create(STREAM_KEY, GROUP_NAME, id="0", mkstream=True)
    except redis.ResponseError:
        pass  # group already exists

    print("Emitting 3 events...")
    emit("Deposited", amount=100)
    emit("Deposited", amount=200)
    emit("Withdrawn", amount=50)

    print(f"\nConsumer 'projector-1' reads via the '{GROUP_NAME}' group (XREADGROUP):")
    messages = r.xreadgroup(GROUP_NAME, "projector-1", {STREAM_KEY: ">"}, count=2)
    for _, entries in messages:
        for event_id, fields in entries:
            print(f"  delivered {event_id}: {fields} (NOT yet acked)")

    pending = r.xpending(STREAM_KEY, GROUP_NAME)
    print(f"\nPending (unacked) entries for the group: {pending['pending']}")
    print("^ Simulates 'projector-1' crashing before acking — Redis remembers")
    print("  these were delivered but not confirmed processed.")

    print("\nA recovery consumer claims stale pending entries (XCLAIM/XAUTOCLAIM):")
    claimed = r.xautoclaim(STREAM_KEY, GROUP_NAME, "projector-2", min_idle_time=0)
    for event_id, fields in claimed[1]:
        print(f"  projector-2 claimed {event_id}: {fields}")
        r.xack(STREAM_KEY, GROUP_NAME, event_id)
        print(f"  projector-2 acked {event_id}")

    remaining = r.xreadgroup(GROUP_NAME, "projector-1", {STREAM_KEY: ">"}, count=10)
    for _, entries in remaining:
        for event_id, fields in entries:
            print(f"  projector-1 reads remaining {event_id}: {fields}")
            r.xack(STREAM_KEY, GROUP_NAME, event_id)

    pending_after = r.xpending(STREAM_KEY, GROUP_NAME)
    print(f"\nPending entries after full recovery: {pending_after['pending']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mode", choices=["append", "replay", "consumer-group"])
    args = parser.parse_args()

    r.ping()

    if args.mode == "append":
        demo_append()
    elif args.mode == "replay":
        demo_replay()
    else:
        demo_consumer_group()
