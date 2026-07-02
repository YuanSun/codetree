#!/usr/bin/env bash
# 03-install-keda.sh — Install KEDA operator via official Helm chart
set -euo pipefail

echo "▶ Adding KEDA Helm repo"
helm repo add kedacore https://kedacore.github.io/charts
helm repo update

echo "▶ Installing KEDA into keda namespace"
helm upgrade --install keda kedacore/keda \
  --namespace keda \
  --create-namespace \
  --version 2.14.0 \
  --set watchNamespace="lab" \
  --wait \
  --timeout 3m

echo ""
echo "✅ KEDA installed. CRDs:"
kubectl get crd | grep keda

echo ""
echo "KEDA operator pods:"
kubectl get pods -n keda
