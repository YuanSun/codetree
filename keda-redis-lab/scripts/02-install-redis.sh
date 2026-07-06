#!/usr/bin/env bash
# 02-install-redis.sh — Deploy standalone Redis via the Bitnami Helm chart
set -euo pipefail

NAMESPACE="redis"

echo "▶ Adding Bitnami Helm repo"
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

echo "▶ Installing Redis into '$NAMESPACE'"
helm upgrade --install redis bitnami/redis \
  --namespace "$NAMESPACE" \
  --create-namespace \
  --version 19.6.4 \
  --values "$(dirname "$0")/../redis/values.yaml" \
  --wait \
  --timeout 5m

echo ""
echo "✅ Redis deployed. Pods:"
kubectl get pods -n "$NAMESPACE"

echo ""
echo "Internal bootstrap address for apps:"
echo "  redis-master.$NAMESPACE.svc.cluster.local:6379"
