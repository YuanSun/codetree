#!/bin/bash

# Test the SSE endpoint
echo "Testing SSE endpoint..."
curl -N -H "Accept: text/event-stream" http://localhost:8080/sse &
CURL_PID=$!

sleep 2

# Test the messages endpoint
echo -e "\nTesting messages endpoint..."
curl -X POST http://localhost:8080/messages \
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
