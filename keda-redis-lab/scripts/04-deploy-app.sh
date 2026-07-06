#!/usr/bin/env bash
# 04-deploy-app.sh — Deploy the consumer Deployment + KEDA ScaledObject
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

echo "▶ Creating ConfigMaps from the Python client scripts"
kubectl create configmap redis-producer-script \
  --from-file=producer.py="$ROOT/apps/producer/producer.py" \
  -n lab --dry-run=client -o yaml | kubectl apply -f -
kubectl create configmap redis-consumer-script \
  --from-file=consumer.py="$ROOT/apps/consumer/consumer.py" \
  -n lab --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "▶ Deploying order-consumer Deployment (starts at 0 replicas)"
kubectl apply -f "$ROOT/apps/consumer/deployment.yaml"

echo ""
echo "▶ Applying KEDA ScaledObject"
kubectl apply -f "$ROOT/keda/scaled-object.yaml"

echo ""
echo "⏳ Waiting for ScaledObject to become ready..."
sleep 5
kubectl get scaledobject -n lab

echo ""
echo "✅ Setup complete. Current state:"
echo ""
echo "Pods in 'lab' namespace (should be 0 consumers — no backlog yet):"
kubectl get pods -n lab

echo ""
echo "HPA created by KEDA:"
kubectl get hpa -n lab

echo ""
echo "Next: run './scripts/06-produce-load.sh' to generate backlog and watch KEDA scale up"
