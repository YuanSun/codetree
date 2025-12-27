# Exposing MCP Server for External Tools

This guide explains how to expose your PostgreSQL MCP server so that other AI tools (Claude Desktop, Continue, Cline, etc.) can connect to it over the network.

## Two Server Modes

### 1. **stdio Mode** (Default - `server.py`)
- Communication via standard input/output
- Only works for local subprocess communication
- Used by the local advisor agent
- **Cannot be accessed remotely**

### 2. **HTTP/SSE Mode** (`server_http.py`)
- Communication via HTTP with Server-Sent Events
- Can be accessed over the network
- **Works with any AI tool that supports MCP over HTTP**
- Recommended for exposing to other tools

## Setting Up HTTP Server

### Step 1: Install HTTP Dependencies

```bash
cd budget-advisor/postgres-mcp-server

# Install base dependencies
pip install -r requirements.txt

# Install HTTP server dependencies
pip install -r requirements-http.txt
```

### Step 2: Configure Environment

Create or update `.env` file:

```bash
# Database configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=budget
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password

# HTTP Server configuration
MCP_SERVER_HOST=0.0.0.0  # Listen on all interfaces
MCP_SERVER_PORT=8080     # Port for the HTTP server
```

**Important:**
- `0.0.0.0` = Listen on all network interfaces (accessible remotely)
- `127.0.0.1` = Only accessible from localhost
- Choose a port that's not already in use (8080, 8000, 3000, etc.)

### Step 3: Run the HTTP Server

```bash
python server_http.py
```

You should see:
```
Starting Budget Advisor PostgreSQL MCP Server (HTTP)...
Server will listen on 0.0.0.0:8080
Database connection pool initialized
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8080
```

### Step 4: Test the Server

From another machine or terminal:

```bash
# Check if server is accessible
curl http://your-server-ip:8080/sse

# Or from the same machine
curl http://localhost:8080/sse
```

## Connecting from AI Tools

### Claude Desktop

Edit your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "budget-advisor": {
      "url": "http://your-server-ip:8080/sse"
    }
  }
}
```

### Continue (VS Code Extension)

Add to `.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "budget-advisor",
      "url": "http://your-server-ip:8080/sse"
    }
  ]
}
```

### Cline or Other MCP Clients

Most MCP clients support HTTP transport. Use:
- **Endpoint**: `http://your-server-ip:8080/sse`
- **Protocol**: SSE (Server-Sent Events)

## Network Access

### Same Network (LAN)

1. Find your server's local IP:
   ```bash
   # On macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1

   # On Windows
   ipconfig
   ```

2. Use that IP in your client tools:
   ```
   http://192.168.1.100:8080/sse
   ```

### Remote Access (Internet)

**Option 1: SSH Tunnel (Secure)**
```bash
# On the client machine
ssh -L 8080:localhost:8080 user@your-server.com

# Then connect to
http://localhost:8080/sse
```

**Option 2: Reverse Proxy (Production)**

Use nginx or caddy as a reverse proxy with HTTPS:

```nginx
server {
    listen 443 ssl;
    server_name budget-mcp.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Option 3: Cloudflare Tunnel (Easy)**
```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Create tunnel
cloudflared tunnel --url http://localhost:8080
```

## Security Considerations

### ⚠️ Important Security Notes

1. **No Built-in Authentication**: The HTTP server has NO authentication by default
2. **Database Access**: Anyone who can reach the server can query your database
3. **Read-Only**: Fortunately, only SELECT queries are allowed (no writes)

### Recommended Security Measures

#### 1. Add IP Whitelisting

Edit `server_http.py` to add IP filtering:

```python
ALLOWED_IPS = ["192.168.1.100", "10.0.0.50"]  # Add your trusted IPs

async def handle_sse(request):
    client_ip = request.client.host
    if client_ip not in ALLOWED_IPS:
        return Response("Forbidden", status_code=403)
    # ... rest of code
```

#### 2. Add API Key Authentication

```python
API_KEY = os.getenv("MCP_API_KEY", "your-secret-key")

async def handle_sse(request):
    auth_header = request.headers.get("Authorization")
    if auth_header != f"Bearer {API_KEY}":
        return Response("Unauthorized", status_code=401)
    # ... rest of code
```

#### 3. Use VPN

Run a VPN (Tailscale, WireGuard, etc.) and only expose the server on the VPN interface.

#### 4. Use Firewall

```bash
# Only allow connections from specific IP
sudo ufw allow from 192.168.1.100 to any port 8080

# Or only allow local network
sudo ufw allow from 192.168.1.0/24 to any port 8080
```

## Running as a Service

### Using systemd (Linux)

Create `/etc/systemd/system/budget-mcp.service`:

```ini
[Unit]
Description=Budget Advisor MCP Server
After=network.target postgresql.service

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/budget-advisor/postgres-mcp-server
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/python server_http.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable budget-mcp
sudo systemctl start budget-mcp
sudo systemctl status budget-mcp
```

### Using Docker

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt requirements-http.txt ./
RUN pip install -r requirements.txt -r requirements-http.txt

COPY server_http.py ./
COPY .env ./

EXPOSE 8080

CMD ["python", "server_http.py"]
```

Build and run:
```bash
docker build -t budget-mcp-server .
docker run -p 8080:8080 --env-file .env budget-mcp-server
```

## Troubleshooting

### Connection Refused

- Check if server is running: `ps aux | grep server_http`
- Check if port is open: `netstat -an | grep 8080`
- Check firewall: `sudo ufw status`

### 502 Bad Gateway (with reverse proxy)

- Ensure MCP server is running on the correct port
- Check proxy configuration
- Look at proxy error logs

### Timeout Errors

- Increase timeout in your client configuration
- Check network latency: `ping your-server-ip`
- Ensure server isn't overloaded

### Database Connection Issues

- Verify database credentials in `.env`
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Test connection: `psql -U your_user -d budget -h localhost`

## Available Tools

The HTTP server exposes the same three tools as the stdio version:

1. **query_expenses** - Custom SELECT queries
2. **get_weekly_expenses** - Weekly summary by category
3. **get_monthly_summary** - Monthly statistics

## Performance Considerations

- **Connection Pooling**: Server uses connection pooling (1-10 connections)
- **Concurrent Clients**: Can handle multiple AI tool connections simultaneously
- **Memory**: Minimal footprint (~50-100MB)
- **CPU**: Low usage unless running complex queries

## Monitoring

### Check Server Status

```bash
# View logs
journalctl -u budget-mcp -f

# Check connections
netstat -an | grep 8080 | grep ESTABLISHED

# Monitor resource usage
top -p $(pgrep -f server_http)
```

### Add Logging

The server logs to stderr by default. To log to a file:

```python
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/budget-mcp.log'),
        logging.StreamHandler(sys.stderr)
    ]
)
```

## Next Steps

1. **Add Authentication**: Implement API key or OAuth
2. **Add Rate Limiting**: Prevent abuse
3. **Add Metrics**: Track usage with Prometheus
4. **Add Caching**: Cache frequent queries with Redis
5. **Add WebSocket Support**: For even lower latency

## Comparison: stdio vs HTTP

| Feature | stdio (`server.py`) | HTTP (`server_http.py`) |
|---------|---------------------|-------------------------|
| Local Access | ✅ Yes | ✅ Yes |
| Remote Access | ❌ No | ✅ Yes |
| Authentication | N/A (subprocess) | ❌ No (add manually) |
| Multi-client | ❌ No | ✅ Yes |
| Network Overhead | None | Low |
| Setup Complexity | Simple | Moderate |
| Security | Isolated | Needs hardening |
| Use Case | Local agent | External AI tools |

## Summary

- Use **`server.py`** (stdio) for your local advisor agent
- Use **`server_http.py`** (HTTP) to expose to other AI tools
- Both can run simultaneously on the same machine
- Always secure your HTTP server before exposing it to untrusted networks
