#!/usr/bin/env bash
# 01-start-cluster.sh — Start a Minikube cluster sized for this lab
set -euo pipefail

PROFILE="keda-lab"

echo "▶ Starting Minikube profile: $PROFILE"
minikube start \
  --profile "$PROFILE" \
  --cpus 4 \
  --memory 8192 \
  --disk-size 30g \
  --kubernetes-version stable

echo "▶ Setting kubectl context to $PROFILE"
kubectl config use-context "$PROFILE"

echo "▶ Creating lab namespace"
kubectl create namespace lab --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "✅ Cluster ready. Nodes:"
kubectl get nodes
