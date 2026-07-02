#!/usr/bin/env bash
# check-lag.sh — One-shot consumer group lag check
set -euo pipefail

BROKER_POD=$(kubectl get pods -n kafka -l app=cp-kafka \
  -o jsonpath='{.items[0].metadata.name}')

echo "Consumer group lag for 'orders-consumer-group' on 'orders-topic':"
echo ""
kubectl exec -n kafka "$BROKER_POD" -- \
  kafka-consumer-groups \
    --bootstrap-server localhost:9092 \
    --group orders-consumer-group \
    --describe

echo ""
echo "Total lag:"
kubectl exec -n kafka "$BROKER_POD" -- \
  kafka-consumer-groups \
    --bootstrap-server localhost:9092 \
    --group orders-consumer-group \
    --describe 2>/dev/null | \
  awk 'NR>1 && $6 ~ /^[0-9]+$/ {sum += $6} END {print sum " messages"}'
