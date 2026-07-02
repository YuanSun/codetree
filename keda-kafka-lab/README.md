# KEDA + Kafka Scaler — Local Lab

A self-contained local lab to observe **KEDA's Kafka consumer-group-lag scaler** in action.
No Confluent Cloud account needed — everything runs inside Minikube.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        Minikube                          │
│                                                          │
│  ┌─────────────┐   messages   ┌──────────────────────┐  │
│  │  Producer   │ ──────────►  │  Kafka (Confluent)   │  │
│  │  (Job/Pod)  │              │  + Zookeeper         │  │
│  └─────────────┘              └──────────┬───────────┘  │
│                                          │ consumer lag  │
│  ┌─────────────┐                         │               │
│  │    KEDA     │ ◄── polls lag ──────────┘               │
│  │ ScaledObject│                                         │
│  └──────┬──────┘                                         │
│         │ scales (0 → N replicas)                        │
│         ▼                                                │
│  ┌─────────────┐                                         │
│  │  Consumer   │  Deployment (starts at 0 replicas)      │
│  │  Workers    │                                         │
│  └─────────────┘                                         │
└──────────────────────────────────────────────────────────┘
```

**Key concept being demonstrated:**  
KEDA watches the consumer group lag on `orders-topic`. When lag exceeds the `lagThreshold`
in the ScaledObject, it scales the consumer Deployment up. When lag drains, it scales back
to zero (scale-to-zero). The `cooldownPeriod` and `pollingInterval` mimic the asymmetric
cooldown pattern used in production.

---

## Prerequisites

```bash
# macOS
brew install minikube kubectl helm

# Or check versions if already installed
minikube version   # >= 1.32
kubectl version    # >= 1.28
helm version       # >= 3.12
```

---

## Quick Start (5 commands)

```bash
# 1. Start the cluster
./scripts/01-start-cluster.sh

# 2. Install Kafka
./scripts/02-install-kafka.sh

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
|-----------------------------------|-------------------------------------------------------|
| Consumer pod count changing       | `kubectl get pods -n lab -w`                          |
| KEDA ScaledObject status          | `kubectl get scaledobject -n lab`                     |
| Consumer group lag                | `./scripts/check-lag.sh`                              |
| KEDA operator logs                | `kubectl logs -n keda deploy/keda-operator -f`        |
| HPA created by KEDA               | `kubectl get hpa -n lab`                              |

---

## Key Files

| File                                      | What it controls                          |
|-------------------------------------------|-------------------------------------------|
| `keda/scaled-object.yaml`                 | The scaling policy (lag threshold, cooldowns) |
| `apps/consumer/deployment.yaml`           | The thing being scaled                    |
| `apps/producer/job.yaml`                  | Generates lag to trigger scaling          |
| `kafka/values.yaml`                       | Confluent Platform Helm config            |

---

## Teardown

```bash
minikube delete --profile keda-lab
```
