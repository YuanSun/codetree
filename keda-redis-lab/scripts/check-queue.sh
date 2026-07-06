#!/usr/bin/env bash
# check-queue.sh — One-shot Redis queue depth check
set -euo pipefail

QUEUE_KEY="orders-queue"

REDIS_POD=$(kubectl get pods -n redis -l app.kubernetes.io/name=redis,app.kubernetes.io/component=master \
  -o jsonpath='{.items[0].metadata.name}')

echo "Queue depth for '$QUEUE_KEY':"
echo ""
kubectl exec -n redis "$REDIS_POD" -c redis -- \
  redis-cli LLEN "$QUEUE_KEY"
