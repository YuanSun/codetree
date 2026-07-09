# Lab 6 — Redis for Pub/Sub

Redis `PUBLISH`/`SUBSCRIBE` is real-time, at-most-once broadcast messaging:
publishers don't know or care who's listening, subscribers get messages
published *while they're connected*, and nothing is stored anywhere.

## Interactive demo (two terminals)

```bash
# terminal 1
python3 pubsub_lab.py subscribe --channel chat:general

# terminal 2
python3 pubsub_lab.py publish --channel chat:general
```

Type messages in terminal 2 and watch them appear in terminal 1 instantly.
Then **stop the subscriber (Ctrl+C)**, publish another message, and restart
the subscriber — notice the message sent while nobody was listening is just
gone. `PUBLISH` returns the number of subscribers that received it; with
nobody connected, that's `0`, and Redis doesn't remember the message for
later.

## The message-loss problem, automated

```bash
python3 pubsub_lab.py loss-demo
```

Publishes 3 messages with no subscriber connected (each reports `0`
receivers), then connects a subscriber and publishes 3 more. The subscriber
only ever sees the "late" messages — the "early" ones were dropped at
publish time, permanently.

This is the key contrast with **Lab 5 (Event Sourcing / Streams)**:
`XADD` appends to a durable log that's still there whether or not anyone's
reading; `PUBLISH` has no log at all. Use Pub/Sub for ephemeral fan-out
(live notifications, cache invalidation broadcasts, chat presence) and
Streams when you need delivery guarantees or replay.

## Pattern subscriptions

```bash
python3 pubsub_lab.py pattern-demo
```

`PSUBSCRIBE chat:*` receives messages published to *any* matching channel
(`chat:general`, `chat:random`, ...) through a single subscription —
useful for routing by topic without one subscription per channel.

## Things to try

- Open 3 subscriber terminals on the same channel and publish once — all 3
  receive it (`PUBLISH` reports the count). Broadcast, not queue semantics:
  contrast with Streams' consumer groups, where each message goes to only
  *one* consumer in a group.
- Watch `redis-cli PUBSUB CHANNELS` and `redis-cli PUBSUB NUMSUB chat:general`
  while a subscriber is connected, to see Redis's own introspection commands.
