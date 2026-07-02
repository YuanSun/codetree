# Lab Experiments

A set of annotated experiments to deepen your understanding of KEDA's Kafka scaler.
Run each after the base setup is working.

---

## Experiment 1 — Observe the Scale-Up Decision

**Goal:** See exactly how KEDA computes desired replicas.

After running `06-produce-load.sh`, watch KEDA operator logs:
```bash
kubectl logs -n keda deploy/keda-operator -f | grep -i "order-consumer"
```

You'll see lines like:
```
Calculated desired replicas for ScaledObject ... desiredReplicas: 7
```

**What's happening:** KEDA fetches the committed offset and the end offset
for every partition in the consumer group, sums the deltas (= total lag),
then divides by `lagThreshold` and rounds up.

Formula: `desiredReplicas = ceil(totalLag / lagThreshold)`

---

## Experiment 2 — Tune the Threshold

Edit `keda/scaled-object.yaml`, change `lagThreshold` to `"5000"`, and re-apply:
```bash
kubectl apply -f keda/scaled-object.yaml
```

With the same 100K message burst, KEDA will now scale to 20 replicas... but
`maxReplicaCount: 10` caps it. This shows how the threshold and max work together.

**Try:** Set `lagThreshold: "1000"` to see very aggressive scaling.

---

## Experiment 3 — Watch Scale-to-Zero

After all messages are consumed, KEDA won't immediately scale to 0 — it waits
for `cooldownPeriod` (300s = 5 min) to pass with consistently zero lag.

Speed it up for demo purposes:
```bash
# Patch the ScaledObject cooldown to 30 seconds
kubectl patch scaledobject order-consumer-scaler -n lab \
  --type=merge \
  -p '{"spec":{"cooldownPeriod":30}}'
```

Then watch:
```bash
kubectl get pods -n lab -w
```

You'll see the consumer pods terminate one by one after 30 seconds of zero lag.

---

## Experiment 4 — The HPA Behind the Scenes

KEDA creates a standard Kubernetes HPA behind the scenes and drives it via
a custom metric. Inspect it:
```bash
kubectl get hpa -n lab -o yaml
```

Notice the `metrics` section uses `type: External` with KEDA's metric name.
This is why KEDA works with any K8s cluster — it doesn't replace HPA, it feeds it.

```bash
kubectl describe hpa -n lab
```

---

## Experiment 5 — Partition ↔ Replica Ceiling

The ScaledObject has `maxReplicaCount: 10` because `orders-topic` has 10 partitions.
Adding more replicas than partitions is wasteful — idle consumers with no partition
assignment. Try producing enough load to push desired replicas past 10 and observe
KEDA respects the cap.

```bash
# Run producer 5 times quickly
for i in {1..5}; do
  kubectl delete job order-producer -n lab --ignore-not-found
  kubectl apply -f apps/producer/job.yaml
  sleep 30
done
```

---

## Experiment 6 — Broken Consumer (No Commits)

What happens if consumers never commit offsets?

Temporarily modify the consumer command in `apps/consumer/deployment.yaml`:
```yaml
command:
  - /bin/bash
  - -c
  - |
    kafka-console-consumer \
      --bootstrap-server ... \
      --topic orders-topic \
      --group orders-consumer-group \
      --consumer-property enable.auto.commit=false   # <-- change this
```

Re-apply, produce load. KEDA will scale up — but lag will never decrease because
offsets aren't being committed. The consumer group will grow unbounded toward
`maxReplicaCount`. This mimics a processing hang or a commit bug.

---

## Key Concepts Reinforced

| Concept               | Where it's visible                                        |
|-----------------------|-----------------------------------------------------------|
| Lag threshold         | `lagThreshold` in scaled-object.yaml                      |
| Scale-to-zero         | Consumer pods go to 0 when no lag                         |
| Asymmetric cooldown   | Fast up (next poll), slow down (cooldownPeriod)           |
| HPA as execution layer| `kubectl get hpa -n lab`                                  |
| Partition ceiling     | maxReplicaCount = number of partitions                    |
| Committed vs end offset | The actual lag KEDA measures                            |
