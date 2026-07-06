# KEDA + Redis Queue Scaler — Local Lab

A self-contained local lab to observe **KEDA's Redis list-length scaler** in action.
Runs entirely inside a [k3d](https://k3d.io/) cluster — no cloud account needed.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                          k3d                              │
│                                                            │
│  ┌─────────────┐   RPUSH      ┌──────────────────────┐   │
│  │  Producer   │ ──────────►  │  Redis (Bitnami)      │   │
│  │  (Job, py)  │              │  list: orders-queue   │   │
│  └─────────────┘              └──────────┬───────────┘   │
│                                          │ LLEN            │
│  ┌─────────────┐                        │                 │
│  │    KEDA     │ ◄── polls length ──────┘                 │
│  │ ScaledObject│                                          │
│  └──────┬──────┘                                          │
│         │ scales (0 → N replicas)                         │
│         ▼                                                 │
│  ┌─────────────┐                                          │
│  │  Consumer   │  Deployment (starts at 0 replicas)       │
│  │  Workers,py │  BLPOP orders-queue                      │
│  └─────────────┘                                          │
└──────────────────────────────────────────────────────────┘
```

**Key concept being demonstrated:**
KEDA watches the length of the `orders-queue` Redis list. When the length exceeds
the `listLength` threshold in the ScaledObject, it scales the consumer Deployment
up. When the queue drains, it scales back to zero (scale-to-zero). The
`cooldownPeriod` and `pollingInterval` mimic the asymmetric cooldown pattern used
in production. This is the Redis analog of the Kafka consumer-lag scaler in
`../keda-kafka-lab` — same pattern, different backlog signal (`LLEN` instead of
consumer-group lag).

Both the producer and consumer are plain Python (`redis-py`) scripts —
see `apps/producer/producer.py` and `apps/consumer/consumer.py`.

---

## Prerequisites

```bash
# macOS
brew install k3d kubectl helm

# Or check versions if already installed
k3d version      # >= 5.6
kubectl version   # >= 1.28
helm version      # >= 3.12
```

---

## Quick Start (5 commands)

```bash
# 1. Start the cluster
./scripts/01-start-cluster.sh

# 2. Install Redis
./scripts/02-install-redis.sh

# 3. Install KEDA
./scripts/03-install-keda.sh

# 4. Deploy the app + ScaledObject
./scripts/04-deploy-app.sh

# 5. Watch KEDA scale in real time
./scripts/05-watch.sh
```

To generate load and trigger scaling:
```bash
./scripts/06-produce-load.sh
```

---

## What to Observe

| What                              | Command                                               |
|-----------------------------------|---------------------------------------------------------|
| Consumer pod count changing       | `kubectl get pods -n lab -w`                          |
| KEDA ScaledObject status          | `kubectl get scaledobject -n lab`                     |
| Redis queue depth                 | `./scripts/check-queue.sh`                            |
| KEDA operator logs                | `kubectl logs -n keda deploy/keda-operator -f`        |
| HPA created by KEDA               | `kubectl get hpa -n lab`                              |

---

## Key Files

| File                                      | What it controls                          |
|-------------------------------------------|--------------------------------------------|
| `keda/scaled-object.yaml`                 | The scaling policy (queue-length threshold, cooldowns) |
| `apps/consumer/consumer.py`               | The Python worker being scaled            |
| `apps/consumer/deployment.yaml`           | The Deployment KEDA scales                |
| `apps/producer/producer.py`               | The Python client that fills the queue    |
| `apps/producer/job.yaml`                  | Generates backlog to trigger scaling      |
| `redis/values.yaml`                       | Bitnami Redis Helm config                 |

---

## Teardown

```bash
k3d cluster delete keda-redis-lab
```
