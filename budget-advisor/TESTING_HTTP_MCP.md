# Testing the HTTP MCP Server

This guide shows you how to manually test the Budget Advisor HTTP MCP server.

## Prerequisites

1. Start the HTTP MCP server:
   ```bash
   cd budget-advisor/postgres-mcp-server
   python3.11 server_http.py
   ```

2. Make sure the server is running on `http://localhost:8080`

## Testing Methods

### Method 1: Quick curl test (Basic connectivity)

Tests if the SSE endpoint is accessible:

```bash
cd budget-advisor
./test_mcp_http.sh
```

This sends basic HTTP requests to verify the server responds.

### Method 2: Automated test script (Full MCP protocol)

Runs a complete test suite that:
- Connects via MCP SSE client
- Lists available tools
- Tests each tool (weekly expenses, monthly summary, query)

```bash
cd budget-advisor
python3.11 test_mcp_client.py
```

**Expected output:**
```
Connecting to MCP server at http://localhost:8080...
Initializing session...
✓ Session initialized successfully

=== Listing available tools ===

📦 Tool: execute_query
   Description: Execute a SELECT query on the database

📦 Tool: get_weekly_expenses
   Description: Get weekly expenses aggregated by category

📦 Tool: get_monthly_summary
   Description: Get monthly expense summary by category

=== Test 1: Get weekly expenses ===
Result: [...]

✅ All tests completed successfully!
```

### Method 3: Interactive MCP client (Manual testing)

An interactive shell to test MCP tools manually:

```bash
cd budget-advisor
python3.11 interactive_mcp_test.py
```

**Available commands:**
- `list` - List all available MCP tools
- `weekly` - Get weekly expenses
- `monthly` - Get current month summary
- `monthly 2024-07` - Get specific month summary
- `query SELECT * FROM expenses LIMIT 5` - Execute custom SELECT query
- `quit` - Exit

**Example session:**
```
🔗 Connecting to MCP server at http://localhost:8080...
✅ Connected successfully!

============================================================
Available commands:
  1. list - List all available tools
  2. weekly - Get weekly expenses
  3. monthly [YYYY-MM] - Get monthly summary
  4. query <SQL> - Execute a SELECT query
  5. quit - Exit
============================================================

Enter command: list

📦 Available tools:
  • execute_query: Execute a SELECT query on the database
  • get_weekly_expenses: Get weekly expenses aggregated by category
  • get_monthly_summary: Get monthly expense summary by category

Enter command: weekly

⏳ Fetching weekly expenses...

📊 Result:
[
  {
    "category": "Food",
    "total_amount": "245.50",
    "transaction_count": 12
  },
  ...
]

Enter command: quit
Goodbye!
```

## Troubleshooting

### Connection refused
- Check if server is running: `ps aux | grep server_http.py`
- Check port: `lsof -i :8080`
- Restart server if needed

### Timeout errors
- Check server logs for errors
- Verify database connection in server logs
- Try simple curl test first

### Import errors
- Make sure you're in the right virtual environment
- Install dependencies: `pip install -r postgres-mcp-server/requirements-http.txt`

## What to check

✅ Server starts without errors
✅ curl test returns event-stream responses
✅ Python test script connects successfully
✅ Tools are listed correctly
✅ Tool calls return data
✅ Database queries work

If all these work, the HTTP MCP server is functioning correctly and ready for external clients like CherryStudio!
