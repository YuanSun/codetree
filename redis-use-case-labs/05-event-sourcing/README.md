# Lab 5 — Redis for Event Sourcing

**Event sourcing**: instead of storing current state directly, store the
sequence of events that produced it, and derive state by replaying the log.
Redis **Streams** (`XADD`, `XRANGE`, `XREADGROUP`, `XACK`) are a natural fit —
an append-only, ordered, durable log with IDs that encode time + sequence.

## Run it

```bash
python3 event_sourcing_lab.py append
```

Appends `AccountOpened` / `Deposited` / `Withdrawn` events for a bank account
to a stream. Note that nothing here *is* "the balance" — just facts, in order.

```bash
python3 event_sourcing_lab.py replay
```

Reads the whole stream with `XRANGE` and folds it into a balance, printing
the running total after each event. The balance is never stored on its own —
it's always a projection computed from the log. Run `append` again (it
resets the stream) and `replay` will reflect the new event sequence exactly.

## Reliable processing: consumer groups

```bash
python3 event_sourcing_lab.py consumer-group
```

Projections built from a shared log need "each event processed exactly
once, and we can tell what's still outstanding" — that's what **consumer
groups** add on top of a bare stream:

1. `XREADGROUP` delivers events to `projector-1`, but they stay **pending**
   (delivered, not yet acknowledged) until `XACK`.
2. The demo checks `XPENDING` to show unacked entries still tracked by Redis
   — simulating `projector-1` crashing mid-processing.
3. A recovery consumer (`projector-2`) uses `XAUTOCLAIM` to take over those
   stale pending entries and acks them.
4. `projector-1` then reads what's left as new (`>`) and acks those too.

This is the guarantee Pub/Sub (Lab 6) does **not** give you — nothing is
remembered for a subscriber that wasn't listening or that crashed.

## Things to try

- Add a new event type (`InterestApplied`) and a second projection function
  (e.g. total interest paid) that replays the *same* stream — no schema
  migration needed, since the log itself never changes.
- Create a second consumer group on the same stream (`XGROUP CREATE ... $`)
  and confirm both groups independently track their own read position —
  multiple projections can consume the same log at different paces.
- Compare `XRANGE` (replay everything, for `replay`) against `XREADGROUP`
  (consume-once, for `consumer-group`) — same stream, two different access
  patterns for two different jobs (rebuilding vs. processing).
