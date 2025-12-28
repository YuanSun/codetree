#!/bin/bash

# Load SERVER_PORT from .env file if it exists
if [ -f "postgres-mcp-server/.env" ]; then
    export $(grep -v '^#' postgres-mcp-server/.env | grep SERVER_PORT | xargs)
fi

# Default to 8080 if not set
SERVER_PORT=${SERVER_PORT:-8080}

echo "Using server port: $SERVER_PORT"

# Test the SSE endpoint
echo "Testing SSE endpoint..."
curl -N -H "Accept: text/event-stream" http://localhost:$SERVER_PORT/sse &
CURL_PID=$!

sleep 2

# Test the messages endpoint
echo -e "\nTesting messages endpoint..."
curl -X POST http://localhost:$SERVER_PORT/messages \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'

kill $CURL_PID 2>/dev/null
