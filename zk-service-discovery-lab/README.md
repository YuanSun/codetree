# ZooKeeper Service Discovery — Local Lab

Goal: build local, hands-on intuition for how ZK-based service discovery actually
behaves under failure — registration, deregistration timing, quorum requirements,
and leader election — using the same "run it, break it, measure it" approach as
the KEDA/Kafka lab.

## Architecture

```
┌────────────────────────────────────────────────────┐
│  macOS (Docker Desktop)                             │
│                                                     │
│  ┌────────┐   ┌────────┐   ┌────────┐              │
│  │  zk1   │   │  zk2   │   │  zk3   │  <- 3-node    │
│  │ :2191  │   │ :2182  │   │ :2183  │     ensemble  │
│  └───┬────┘   └───┬────┘   └───┬────┘              │
│      └────────────┴────────────┘                   │
│              ZK quorum protocol                     │
│                                                     │
│  Java (Curator) processes on host, connecting to    │
│  all 3 nodes via localhost:2191,2182,2183:          │
│                                                     │
│  ┌──────────────────┐   ┌──────────────────┐        │
│  │ ServiceRegistrar │   │  ServiceWatcher  │        │
│  │ (N instances)    │   │  (observer)      │        │
│  └──────────────────┘   └──────────────────┘        │
└────────────────────────────────────────────────────┘
```

Each `ServiceRegistrar` creates one **ephemeral znode** under
`/services/<service-name>/<instance-id>` on startup via Curator's
`curator-x-discovery` module (the ZK-native equivalent of what Consul/Eureka do at
the protocol level). The znode disappears automatically when the client's ZK
session ends — either because the client closed cleanly, or because ZK's session
timeout expired without a heartbeat.

## Prerequisites

- Docker Desktop (for the ensemble)
- Java 11+ (for the client — the bundled Gradle wrapper downloads Gradle itself, no separate install needed)
- `nc` (netcat) — pre-installed on macOS

## Quickstart

```bash
chmod +x scripts/*.sh
./scripts/01-start-ensemble.sh
./scripts/02-check-quorum.sh
./scripts/03-build-client.sh
```

Then follow `EXPERIMENTS.md` for the actual lab sequence — that file has the
hypotheses, exact commands, and what to record for each failure scenario.

## Cleanup

```bash
docker compose down -v
```

## Why curator-x-discovery specifically

You could do this lab with raw znode CRUD (`create -e /services/orders/i1 <json>`
via zkCli) and it would teach the same core mechanic. `curator-x-discovery` is used
here instead because it's what real systems actually build on (Curator is an
Apache project used inside Kafka-adjacent and Hadoop-ecosystem tooling), and it
handles the JSON serialization, ephemeral-node lifecycle, and reconnection edge
cases for you — which lets the experiments focus on the ZK *behavior* rather than
serialization boilerplate. Experiment 1 has you inspect the raw znode directly with
zkCli anyway, so you still see exactly what Curator wrote under the hood.
