# Lab Experiments

A set of annotated experiments to deepen your understanding of KEDA's Redis
list scaler. Run each after the base setup is working.

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

**What's happening:** KEDA runs `LLEN orders-queue` against Redis, divides the
result by `listLength`, and rounds up.

Formula: `desiredReplicas = ceil(queueLength / listLength)`

---

## Experiment 2 — Tune the Threshold

Edit `keda/scaled-object.yaml`, change `listLength` to `"500"`, and re-apply:
```bash
kubectl apply -f keda/scaled-object.yaml
```

With the same 20,000-job burst, KEDA will now want 40 replicas... but
`maxReplicaCount: 10` caps it. This shows how the threshold and max work together.

**Try:** Set `listLength: "10000"` to see much lazier scaling (2 replicas for
the same burst).

---

## Experiment 3 — Watch Scale-to-Zero

After all jobs are consumed, KEDA won't immediately scale to 0 — it waits for
`cooldownPeriod` (120s) to pass with a drained queue.

Speed it up for demo purposes:
```bash
# Patch the ScaledObject cooldown to 15 seconds
kubectl patch scaledobject order-consumer-scaler -n lab \
  --type=merge \
  -p '{"spec":{"cooldownPeriod":15}}'
```

Then watch:
```bash
kubectl get pods -n lab -w
```

You'll see the consumer pods terminate one by one after 15 seconds of an empty queue.

---

## Experiment 4 — The HPA Behind the Scenes

KEDA creates a standard Kubernetes HPA behind the scenes and drives it via a
custom metric. Inspect it:
```bash
kubectl get hpa -n lab -o yaml
```

Notice the `metrics` section uses `type: External` with KEDA's metric name.
This is why KEDA works with any K8s cluster — it doesn't replace HPA, it feeds it.

```bash
kubectl describe hpa -n lab
```

---

## Experiment 5 — Activation Threshold vs Scaling Threshold

The ScaledObject sets `activationListLength: "5"` separately from
`listLength: "2000"`. KEDA only activates the workload (0 → 1 replica) once
the queue has at least `activationListLength` items, then uses `listLength`
to compute replicas beyond that.

Push a tiny amount of backlog and confirm nothing scales up:
```bash
kubectl exec -n redis "$(kubectl get pods -n redis -l app.kubernetes.io/name=redis,app.kubernetes.io/component=master -o jsonpath='{.items[0].metadata.name}')" \
  -c redis -- redis-cli RPUSH orders-queue '{"seq":0}' '{"seq":1}'
kubectl get pods -n lab -w
```

With only 2 items queued (below `activationListLength: 5`), KEDA stays at 0
replicas. Push a few more past the threshold and watch it activate.

---

## Experiment 6 — Lossy Consumer (BLPOP vs Reliable Queue)

`consumer.py` uses `BLPOP`, which removes the item from the list the instant
it's popped — if the pod crashes mid-`time.sleep()`, that job is lost forever.
This mimics an at-most-once processing bug.

Kill a worker mid-job and check whether the queue "remembers" the in-flight item:
```bash
kubectl delete pod -n lab -l app=order-consumer --grace-period=0 --force
./scripts/check-queue.sh
```

**Discuss:** A production-grade version would use `BRPOPLPUSH` (or Redis
Streams with consumer groups) to move the item into a processing list first,
so a crashed worker's in-flight jobs can be recovered instead of silently
dropped.

---

## Key Concepts Reinforced

| Concept                  | Where it's visible                                        |
|---------------------------|-----------------------------------------------------------|
| Queue-length threshold     | `listLength` in scaled-object.yaml                        |
| Scale-to-zero              | Consumer pods go to 0 when the queue is empty             |
| Activation threshold       | `activationListLength` gates the 0 → 1 transition          |
| Asymmetric cooldown        | Fast up (next poll), slow down (cooldownPeriod)           |
| HPA as execution layer     | `kubectl get hpa -n lab`                                  |
| At-most-once delivery risk | `BLPOP` loses in-flight jobs on worker crash               |
