#!/usr/bin/env bash
# 05-watch.sh — Live dashboard showing pod count, lag, and ScaledObject status
set -euo pipefail

KAFKA_NS="kafka"
LAB_NS="lab"

# Get the kafka broker pod name
BROKER_POD=$(kubectl get pods -n "$KAFKA_NS" -l app=cp-kafka \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  KEDA + Kafka Scaler — Live Lab Monitor"
echo "  Press Ctrl+C to exit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

while true; do
  clear
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  KEDA + Kafka Scaler — Live Lab Monitor  $(date '+%H:%M:%S')"
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
  echo "── Consumer Group Lag ────────────────────────────"
  if [ -n "$BROKER_POD" ]; then
    kubectl exec -n "$KAFKA_NS" "$BROKER_POD" -- \
      kafka-consumer-groups \
        --bootstrap-server localhost:9092 \
        --group orders-consumer-group \
        --describe \
        2>/dev/null | \
      grep -v "^$" | head -20 || echo "  (consumer group not yet active)"
  else
    echo "  (broker pod not found)"
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
