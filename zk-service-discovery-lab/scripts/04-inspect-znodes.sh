#!/bin/bash
SERVICE_NAME="${1:-orders-service}"

echo "=== Children of /services ==="
docker exec zk1 zkCli.sh -server localhost:2181 ls /services 2>/dev/null | tail -1

echo ""
echo "=== Children of /services/$SERVICE_NAME (one ephemeral znode per instance) ==="
docker exec zk1 zkCli.sh -server localhost:2181 ls "/services/$SERVICE_NAME" 2>/dev/null | tail -1

echo ""
echo "To see the JSON payload Curator stored for a specific instance, run:"
echo "  docker exec -it zk1 zkCli.sh -server localhost:2181 get /services/$SERVICE_NAME/<instance-id>"
echo ""
echo "To confirm a znode is EPHEMERAL (ephemeralOwner != 0x0), run:"
echo "  docker exec -it zk1 zkCli.sh -server localhost:2181 stat /services/$SERVICE_NAME/<instance-id>"
