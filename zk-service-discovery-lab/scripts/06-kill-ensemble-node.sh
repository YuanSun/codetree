#!/bin/bash
# Usage: ./06-kill-ensemble-node.sh <1|2|3> <stop|start>

NODE="$1"
ACTION="${2:-stop}"

if [ -z "$NODE" ]; then
  echo "Usage: $0 <1|2|3> <stop|start>"
  exit 1
fi

CONTAINER="zk$NODE"

if [ "$ACTION" == "stop" ]; then
  echo "Stopping $CONTAINER..."
  docker stop "$CONTAINER"
  echo "Run 02-check-quorum.sh now to see the remaining nodes re-elect a leader"
  echo "(only relevant if you just stopped the current leader)."
else
  echo "Starting $CONTAINER..."
  docker start "$CONTAINER"
  echo "Give it ~10s to rejoin and sync, then re-run 02-check-quorum.sh."
fi
