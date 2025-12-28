# Using the Budget Advisor MCP Server with AI Tools

This guide shows you how to connect the HTTP MCP server to AI tools like CherryStudio, Claude Desktop, or other MCP-compatible clients.

## Important: HTTP vs Stdio Transport

The Budget Advisor MCP server supports **two transport modes**:

1. **Stdio transport** (`server.py`) - For local tools that spawn the server as a subprocess
2. **HTTP/SSE transport** (`server_http.py`) - For remote tools that connect via HTTP

**CherryStudio and most AI tools expect HTTP/SSE for remote servers.**

## Configuration for CherryStudio

### Option 1: Using the HTTP Server (Recommended for CherryStudio)

**1. Start the HTTP server manually:**
```bash
cd budget-advisor/postgres-mcp-server
python3.11 server_http.py
```

Keep this running in a terminal.

**2. In CherryStudio, add an MCP server:**

- Click on "Settings" or "MCP Servers"
- Click "Add Server"
- Choose **"SSE (Server-Sent Events)"** or **"HTTP"** transport type (NOT stdio)
- Enter the server URL:
  ```
  http://localhost:8080/sse
  ```
  (Use your configured port if you changed it in `.env`)

**3. Important settings:**

- **Transport Type**: SSE or HTTP (not stdio)
- **URL**: `http://localhost:8080/sse`
- **Do NOT enable**: "Auto-start server" or "Manage server lifecycle"

  The HTTP server runs independently - CherryStudio just connects to it.

**4. Test the connection:**

After adding the server, CherryStudio should show:
- Status: Connected ✓
- Available tools: execute_query, get_weekly_expenses, get_monthly_summary

### Option 2: Using Stdio Transport (For Claude Desktop)

If your AI tool can spawn local processes (like Claude Desktop), use the stdio server:

**Configuration for Claude Desktop (`claude_desktop_config.json`):**

```json
{
  "mcpServers": {
    "budget-advisor": {
      "command": "python3.11",
      "args": [
        "/absolute/path/to/budget-advisor/postgres-mcp-server/server.py"
      ],
      "env": {
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_DB": "budget",
        "POSTGRES_USER": "your_user",
        "POSTGRES_PASSWORD": "your_password"
      }
    }
  }
}
```

## Using the MCP Server in Conversation

Once connected, you can ask the AI tool questions like:

**Example questions:**
- "What were my expenses this week?"
- "Show me my monthly spending by category"
- "Compare my spending in July vs August"
- "What categories did I spend the most on this month?"
- "Run a query to show all food expenses over $50"

The AI will automatically:
1. Understand your question
2. Call the appropriate MCP tool (get_weekly_expenses, get_monthly_summary, or execute_query)
3. Get data from your PostgreSQL database
4. Analyze and respond with insights

## Troubleshooting CherryStudio

### Error: "Request timed out" when adding server

**Cause**: CherryStudio might be trying to call `restart-server` or manage the server lifecycle.

**Solution**:
1. Make sure the HTTP server is already running before adding it to CherryStudio
2. In CherryStudio settings, disable any options like:
   - "Auto-start server"
   - "Manage server lifecycle"
   - "Auto-restart on failure"
3. Choose **SSE** or **HTTP** transport type, NOT stdio
4. Use the `/sse` endpoint: `http://localhost:8080/sse`

### Error: "Connection refused"

**Check**:
```bash
# Is the server running?
ps aux | grep server_http.py

# Is the port correct?
lsof -i :8080
```

**Restart server if needed**:
```bash
cd budget-advisor/postgres-mcp-server
python3.11 server_http.py
```

### Server connects but tools don't appear

**Test the connection manually**:
```bash
cd budget-advisor
python3.11 test_mcp_client.py
```

If this works but CherryStudio doesn't:
- Check CherryStudio's MCP protocol version (should be 2024-11-05)
- Try removing and re-adding the server
- Check CherryStudio's console/logs for errors

### CherryStudio shows "Disconnected" status

**Possible causes**:
1. Server not running - start it with `python3.11 server_http.py`
2. Wrong URL - verify the port and path (`/sse`)
3. Firewall blocking connection - check firewall settings
4. Database connection failed - check server logs for database errors

## Verifying Everything Works

**Complete test workflow**:

1. **Start server**:
   ```bash
   cd budget-advisor/postgres-mcp-server
   python3.11 server_http.py
   # Should show: "MCP Server ready to accept connections"
   ```

2. **Test with Python client**:
   ```bash
   cd budget-advisor
   python3.11 test_mcp_client.py
   # Should show: "✅ All tests completed successfully!"
   ```

3. **Add to CherryStudio**:
   - Transport: SSE
   - URL: `http://localhost:8080/sse`
   - Should show: Status Connected ✓

4. **Test in conversation**:
   Ask: "What were my expenses this week?"

   The AI should call `get_weekly_expenses` and show your data.

## Example Conversation

```
You: What did I spend on food this month?

AI: Let me check your food expenses for this month.
    [Calls MCP tool: get_monthly_summary]

    Based on your budget data:
    - Food category: $450.25
    - Restaurant/Dining: $230.50
    - Groceries: $219.75
    Total food-related spending: $680.50

You: How does that compare to last month?

AI: [Calls MCP tool: get_monthly_summary with month="2024-11"]

    Comparison:
    - This month (December): $680.50
    - Last month (November): $612.30
    - Increase: $68.20 (+11.1%)

    You spent slightly more this month, primarily in restaurants.
```

## Advanced: Accessing from Other Machines

To use the MCP server from another machine on your network:

1. **Configure server to listen on all interfaces**:
   Edit `.env`:
   ```bash
   SERVER_HOST=0.0.0.0
   SERVER_PORT=8080
   ```

2. **Find your machine's IP**:
   ```bash
   # macOS
   ipconfig getifaddr en0

   # Linux
   hostname -I
   ```

3. **Use the IP in CherryStudio**:
   ```
   http://192.168.1.100:8080/sse
   ```

4. **Configure firewall** to allow port 8080

## Security Note

The HTTP MCP server has **no authentication** by default. Only expose it on trusted networks or add authentication if exposing to the internet.
