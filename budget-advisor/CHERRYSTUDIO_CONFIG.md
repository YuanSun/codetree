# CherryStudio Configuration for Budget Advisor MCP Server

## Quick Diagnostic

Before configuring CherryStudio, verify the server works:

```bash
# Terminal 1: Start the server
cd budget-advisor/postgres-mcp-server
python3.11 server_http.py

# Terminal 2: Test it works
cd budget-advisor
python3.11 test_mcp_client.py
```

If the test passes (shows "✅ All tests completed successfully!"), the server is working correctly.

## CherryStudio Configuration

### Method 1: SSE Transport (Recommended)

**In CherryStudio:**

1. Go to **Settings** → **MCP Servers** → **Add Server**

2. Fill in the configuration:
   - **Name**: Budget Advisor
   - **Type**: `Server-Sent Events (SSE)` or `Remote Server`
   - **URL**: `http://localhost:8080/sse`
   - **Protocol Version**: `2024-11-05` (or latest)

3. **Important**: Do NOT enable:
   - ❌ Auto-start server
   - ❌ Manage server lifecycle
   - ❌ Auto-restart on failure

   These options are for local stdio servers that CherryStudio spawns. Your HTTP server runs independently.

4. Click **Test Connection** (if available)

5. Click **Save**

### Method 2: If CherryStudio Uses JSON Configuration

Some versions use a JSON config file. Edit `~/.cherry-studio/config.json` (or similar):

```json
{
  "mcpServers": {
    "budget-advisor": {
      "type": "sse",
      "url": "http://localhost:8080/sse",
      "description": "Budget Advisor MCP Server"
    }
  }
}
```

Then restart CherryStudio.

### Method 3: Command-Line Configuration

If CherryStudio supports CLI configuration:

```bash
cherry-studio mcp add \
  --name "Budget Advisor" \
  --type sse \
  --url "http://localhost:8080/sse"
```

## Troubleshooting

### Error: "Request timed out" or "mcp:restart-server timeout"

**Cause**: CherryStudio is trying to manage the server lifecycle.

**Solutions**:

1. **Make sure the server is already running** before adding it to CherryStudio
   ```bash
   ps aux | grep server_http.py
   ```

2. **Use SSE/Remote transport type**, NOT stdio

3. **Check CherryStudio version** - older versions might not support HTTP MCP servers well:
   ```bash
   cherry-studio --version
   ```
   Update to the latest version if possible.

4. **Try adding via JSON config** instead of UI (see Method 2 above)

### Error: "Connection refused"

1. **Check if server is running:**
   ```bash
   lsof -i :8080
   ```

2. **Check the logs** in the server terminal for errors

3. **Test with curl:**
   ```bash
   curl -N -H "Accept: text/event-stream" http://localhost:8080/sse
   ```
   Should keep the connection open and not return errors

### Server connects but no tools appear

1. **Check server logs** - should show successful initialization

2. **Test manually:**
   ```bash
   python3.11 test_mcp_client.py
   ```
   Should list 3 tools: execute_query, get_weekly_expenses, get_monthly_summary

3. **Check CherryStudio's console/logs** for MCP protocol errors

4. **Verify protocol version** - CherryStudio and server should use compatible versions

### CherryStudio shows "Disconnected" immediately

**Possible causes:**

1. **Server crashed** - check server terminal for errors
2. **Wrong URL** - verify port number and `/sse` path
3. **Database connection failed** - check PostgreSQL is running:
   ```bash
   psql -h localhost -U your_user -d budget -c "SELECT 1"
   ```

## Verify It's Working

Once configured, in a CherryStudio chat:

**You**: What were my expenses this week?

**Expected behavior**:
- CherryStudio calls `get_weekly_expenses` MCP tool
- Returns your expense data grouped by category

**If you see an error instead:**

1. Check server terminal - should show incoming request logs
2. Check CherryStudio console for MCP errors
3. Run `python3.11 interactive_mcp_test.py` to verify server works outside CherryStudio

## Alternative: Use stdio Transport with Wrapper

If CherryStudio really doesn't work well with HTTP MCP servers, you can configure it to use the stdio server instead:

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
        "POSTGRES_DB": "budget",
        "POSTGRES_USER": "your_user",
        "POSTGRES_PASSWORD": "your_password"
      }
    }
  }
}
```

This way CherryStudio spawns and manages the server itself via stdio transport.

## Getting Help

If none of this works, please share:

1. **CherryStudio version**: `cherry-studio --version`
2. **Server logs**: Copy the output from `server_http.py`
3. **CherryStudio logs**: Usually in `~/.cherry-studio/logs/`
4. **Test client result**: Output from `python3.11 test_mcp_client.py`

This will help diagnose whether the issue is with the server or CherryStudio configuration.
