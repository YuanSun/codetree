#!/usr/bin/env bash
# 02-install-kafka.sh — Deploy Confluent Platform (Kafka + Zookeeper) via Helm
#
# We use the official Confluent Helm charts (confluent/confluent-for-kubernetes
# is the operator path; here we use the simpler cp-helm-charts for local dev).
set -euo pipefail

NAMESPACE="kafka"

echo "▶ Creating kafka namespace"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

echo "▶ Adding Confluent Helm repo"
helm repo add confluentinc https://confluentinc.github.io/cp-helm-charts/
helm repo update

echo "▶ Installing Confluent Platform (Kafka + Zookeeper)"
helm upgrade --install confluent-kafka confluentinc/cp-helm-charts \
  --namespace "$NAMESPACE" \
  --version 0.6.1 \
  --values "$(dirname "$0")/../kafka/values.yaml" \
  --wait \
  --timeout 5m

echo ""
echo "✅ Kafka deployed. Pods:"
kubectl get pods -n "$NAMESPACE"

echo ""
echo "▶ Creating the orders-topic (the topic KEDA will watch)"
kubectl exec -n "$NAMESPACE" \
  "$(kubectl get pods -n kafka -l app=cp-kafka -o jsonpath='{.items[0].metadata.name}')" \
  -- kafka-topics \
    --bootstrap-server localhost:9092 \
    --create \
    --topic orders-topic \
    --partitions 10 \
    --replication-factor 1 \
    --if-not-exists

echo "✅ Topic 'orders-topic' created with 10 partitions"

echo ""
echo "Internal bootstrap address for apps:"
echo "  confluent-kafka-cp-kafka.kafka.svc.cluster.local:9092"
