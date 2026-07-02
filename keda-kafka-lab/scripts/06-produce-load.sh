#!/usr/bin/env bash
# 06-produce-load.sh — Submit the producer Job to generate lag
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

# Delete any previous run
kubectl delete job order-producer -n lab --ignore-not-found

echo "▶ Submitting producer Job (100,000 messages → orders-topic)"
kubectl apply -f "$ROOT/apps/producer/job.yaml"

echo ""
echo "⏳ Waiting for producer to start..."
kubectl wait --for=condition=ready pod \
  -l app=order-producer \
  -n lab \
  --timeout=60s 2>/dev/null || true

echo ""
echo "▶ Producer logs (streaming):"
kubectl logs -n lab -l app=order-producer -f --tail=20 &

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " While the producer runs, KEDA will:"
echo "   1. Detect rising lag every 15s (pollingInterval)"
echo "   2. Compute: ceil(lag / 10000) desired replicas"
echo "   3. Scale order-consumer Deployment up"
echo "   4. After lag clears: wait 300s before scaling down"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Watch it in action: ./scripts/05-watch.sh"
