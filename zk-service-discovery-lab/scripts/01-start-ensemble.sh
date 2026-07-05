#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Starting 3-node ZooKeeper ensemble..."
docker compose up -d

echo "Waiting for nodes to come up..."
sleep 8

for port in 2191 2182 2183; do
  echo -n "zk on :$port -> "
  RESPONSE=$(echo ruok | nc -w 2 localhost $port || echo "NO RESPONSE")
  echo "$RESPONSE"
done

echo ""
echo "If all three printed 'imok', the ensemble is up. If any printed 'NO RESPONSE',"
echo "give it a few more seconds (ensemble leader election on cold start can take ~10-15s)"
echo "and re-run: echo ruok | nc localhost <port>"
