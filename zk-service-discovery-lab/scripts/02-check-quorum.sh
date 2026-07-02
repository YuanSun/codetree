#!/bin/bash

echo "Checking role of each ensemble member (leader vs follower)..."
echo ""

for i in 1 2 3; do
  port=$((2180 + i))
  echo "--- zk$i (localhost:$port) ---"
  STATE=$(echo mntr | nc -w 2 localhost $port 2>/dev/null | grep "zk_server_state" || echo "unreachable")
  echo "$STATE"
  echo ""
done

echo "Exactly one node should report 'leader', the other two 'follower'."
echo "If you see zero leaders, the ensemble has lost quorum (see Experiment 5)."
