#!/usr/bin/env bash
# 01-start-cluster.sh — Start a k3d cluster sized for this lab
set -euo pipefail

CLUSTER="keda-redis-lab"

echo "▶ Creating k3d cluster: $CLUSTER"
k3d cluster create "$CLUSTER" \
  --agents 2 \
  --servers 1 \
  --wait

echo "▶ Setting kubectl context to k3d-$CLUSTER"
kubectl config use-context "k3d-$CLUSTER"

echo "▶ Creating lab namespace"
kubectl create namespace lab --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "✅ Cluster ready. Nodes:"
kubectl get nodes
