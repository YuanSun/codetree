#!/usr/bin/env bash
# 03-install-keda.sh — Install KEDA operator via official Helm chart
set -euo pipefail

echo "▶ Adding KEDA Helm repo"
helm repo add kedacore https://kedacore.github.io/charts
helm repo update

echo "▶ Installing KEDA into keda namespace"
# NOTE: don't set watchNamespace here. When it's set, the chart replaces its
# cluster-wide ClusterRoleBinding with a RoleBinding scoped to only that
# namespace — but the operator's cert-rotation feature needs to read/write
# a Secret in its own release namespace ("keda"), which is then left
# uncovered. That breaks cert generation and crash-loops the admission
# webhook and metrics-apiserver (both fail on missing /certs/*.crt).
# Cluster-wide watch is fine for this single-tenant local lab.
helm upgrade --install keda kedacore/keda \
  --namespace keda \
  --create-namespace \
  --version 2.14.0 \
  --wait \
  --timeout 3m

echo ""
echo "✅ KEDA installed. CRDs:"
kubectl get crd | grep keda

echo ""
echo "KEDA operator pods:"
kubectl get pods -n keda
