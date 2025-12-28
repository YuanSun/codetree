# HTTP MCP Server Port Configuration

## Quick Start

If port 8080 is already in use on your system, you can configure the HTTP MCP server to use a different port.

### Step 1: Create .env file

```bash
cd budget-advisor/postgres-mcp-server
cp .env.example .env
```

### Step 2: Edit the port

Open `.env` and change the `SERVER_PORT` value:

```bash
# Change from default 8080 to any available port
SERVER_PORT=8888
```

You can also change the host if needed:
```bash
SERVER_HOST=127.0.0.1  # Listen only on localhost
# or
SERVER_HOST=0.0.0.0    # Listen on all interfaces (default)
```

### Step 3: Start the server

```bash
python3.11 server_http.py
```

You should see:
```
INFO:__main__:Server will listen on 0.0.0.0:8888
```

### Step 4: Test with the new port

All test scripts automatically read the `SERVER_PORT` from your `.env` file:

```bash
cd budget-advisor

# Automated test
python3.11 test_mcp_client.py

# Interactive test
python3.11 interactive_mcp_test.py

# Curl test
./test_mcp_http.sh
```

### Step 5: Connect with CherryStudio

Use the URL with your custom port:
```
http://localhost:8888/sse
```

## Troubleshooting

**Port still in use?**
```bash
# Check what's using the port
lsof -i :8080

# Kill the process if needed
kill <PID>
```

**Server not accessible from other machines?**
- Make sure `SERVER_HOST=0.0.0.0` in your `.env`
- Check firewall settings
- Use `http://<your-ip>:<port>/sse` instead of `localhost`

**Environment variable not loading?**
- Make sure the `.env` file is in `budget-advisor/postgres-mcp-server/`
- Check for typos in variable names
- Restart the server after changing `.env`
