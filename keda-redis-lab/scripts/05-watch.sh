#!/usr/bin/env bash
# 05-watch.sh — Live dashboard showing pod count, queue depth, and ScaledObject status
set -euo pipefail

REDIS_NS="redis"
LAB_NS="lab"
QUEUE_KEY="orders-queue"

# Get the redis master pod name
REDIS_POD=$(kubectl get pods -n "$REDIS_NS" -l app.kubernetes.io/name=redis,app.kubernetes.io/component=master \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  KEDA + Redis Queue Scaler — Live Lab Monitor"
echo "  Press Ctrl+C to exit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

while true; do
  clear
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  KEDA + Redis Queue Scaler — Live Lab Monitor  $(date '+%H:%M:%S')"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  echo ""
  echo "── Consumer Pods (KEDA scales this) ──────────────"
  kubectl get pods -n "$LAB_NS" -l app=order-consumer \
    --no-headers 2>/dev/null | \
    awk '{print "  " $1 "  " $3}' || echo "  (none — scale-to-zero active)"

  POD_COUNT=$(kubectl get pods -n "$LAB_NS" -l app=order-consumer \
    --no-headers 2>/dev/null | wc -l | tr -d ' ')
  echo "  Total running: $POD_COUNT"

  echo ""
  echo "── ScaledObject Status ───────────────────────────"
  kubectl get scaledobject order-consumer-scaler -n "$LAB_NS" \
    -o custom-columns=\
'NAME:.metadata.name,READY:.status.conditions[0].status,REPLICAS:.status.currentReplicas,DESIRED:.status.desiredReplicas' \
    2>/dev/null || echo "  (not found)"

  echo ""
  echo "── HPA (created by KEDA) ─────────────────────────"
  kubectl get hpa -n "$LAB_NS" 2>/dev/null || echo "  (not found)"

  echo ""
  echo "── Redis Queue Depth ─────────────────────────────"
  if [ -n "$REDIS_POD" ]; then
    LEN=$(kubectl exec -n "$REDIS_NS" "$REDIS_POD" -c redis -- \
      redis-cli LLEN "$QUEUE_KEY" 2>/dev/null || echo "?")
    echo "  LLEN $QUEUE_KEY = $LEN"
  else
    echo "  (redis pod not found)"
  fi

  echo ""
  echo "── Recent KEDA Operator Events ──────────────────"
  kubectl get events -n "$LAB_NS" \
    --sort-by='.lastTimestamp' \
    --field-selector reason=KEDAScaleTargetActivated \
    2>/dev/null | tail -5 || true
  kubectl get events -n "$LAB_NS" \
    --sort-by='.lastTimestamp' \
    --field-selector reason=KEDAScaleTargetDeactivated \
    2>/dev/null | tail -5 || true

  sleep 10
done
