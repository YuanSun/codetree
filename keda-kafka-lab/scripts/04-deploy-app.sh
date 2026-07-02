#!/usr/bin/env bash
# 04-deploy-app.sh — Deploy the consumer Deployment + KEDA ScaledObject
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."

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
echo "Pods in 'lab' namespace (should be 0 consumers — no lag yet):"
kubectl get pods -n lab

echo ""
echo "HPA created by KEDA:"
kubectl get hpa -n lab

echo ""
echo "Next: run './scripts/06-produce-load.sh' to generate lag and watch KEDA scale up"
