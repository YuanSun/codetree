# Obsidian MCP Server

Model Context Protocol (MCP) server for Obsidian vault integration. Connect your Obsidian vault to AI agents and tools via the Local REST API plugin.

## Features

- 📝 **Note Operations**: Create, read, update, append, and delete notes
- 🔍 **Search**: Full-text search across your vault
- 📁 **File Management**: List files and directories
- 🏷️ **Tags**: Get all tags used in your vault
- 🎯 **Active File**: Get currently active file in Obsidian
- 🔒 **Secure**: Uses HTTPS with API key authentication

## Prerequisites

1. **Obsidian** installed on your system
2. **Local REST API plugin** installed and configured in Obsidian
   - Install from Obsidian Community Plugins: "Local REST API"
   - Enable the plugin in Settings → Community Plugins
   - Configure the plugin settings:
     - Enable HTTPS
     - Set port (default: 27124)
     - Generate API key

## Installation

### 1. Install Dependencies

```bash
cd obsidian-mcp-server
pip install -r requirements.txt
```

### 2. Configure Environment

Copy the example configuration:

```bash
cp .env.example .env
```

Edit `.env` with your Obsidian settings:

```bash
# Base URL for Obsidian Local REST API
OBSIDIAN_BASE_URL=https://127.0.0.1:27124

# API Key from Local REST API plugin settings
OBSIDIAN_API_KEY=your-api-key-here

# Path to your Obsidian vault
OBSIDIAN_VAULT_PATH=/Users/yourusername/Documents/ObsidianVault
```

**To get your API key:**
1. Open Obsidian
2. Go to Settings → Community Plugins → Local REST API
3. Copy the API Key shown in the settings

### 3. Verify Obsidian Local REST API is Running

Check that the API is accessible:

```bash
curl -k -H "Authorization: Bearer YOUR_API_KEY" https://127.0.0.1:27124/vault/
```

You should receive a JSON response with vault information.

## Usage

### Start the MCP Server

```bash
cd obsidian-mcp-server
python3.11 server.py
```

The server will start with SSE (Server-Sent Events) transport, ready to accept MCP connections.

### Configure in Antigravity IDE

Add to your Antigravity MCP configuration:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "python3.11",
      "args": ["/path/to/codetree/obsidian-mcp-server/server.py"],
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key-here",
        "OBSIDIAN_VAULT_PATH": "/Users/yourusername/Documents/ObsidianVault",
        "OBSIDIAN_BASE_URL": "https://127.0.0.1:27124"
      }
    }
  }
}
```

## Available Tools

### 1. get_vault_info
Get information about the Obsidian vault.

**Parameters:** None

**Example:**
```python
result = await session.call_tool("get_vault_info", {})
```

### 2. list_files
List files in vault or specific directory.

**Parameters:**
- `path` (string, optional): Directory path (empty for root)

**Example:**
```python
# List all files in root
result = await session.call_tool("list_files", {"path": ""})

# List files in specific folder
result = await session.call_tool("list_files", {"path": "Projects"})
```

### 3. get_note
Get content of a note.

**Parameters:**
- `file_path` (string, required): Path to the note file

**Example:**
```python
result = await session.call_tool("get_note", {
    "file_path": "Daily Notes/2026-02-11.md"
})
```

### 4. create_note
Create a new note in the vault.

**Parameters:**
- `file_path` (string, required): Path where to create the note
- `content` (string, required): Content in markdown format

**Example:**
```python
result = await session.call_tool("create_note", {
    "file_path": "Ideas/New Idea.md",
    "content": "# New Idea\n\nThis is my new idea..."
})
```

### 5. update_note
Update existing note content (replaces entire content).

**Parameters:**
- `file_path` (string, required): Path to the note
- `content` (string, required): New content

**Example:**
```python
result = await session.call_tool("update_note", {
    "file_path": "Tasks/Todo.md",
    "content": "# Updated Todo List\n\n- [ ] Task 1\n- [x] Task 2"
})
```

### 6. append_to_note
Append content to existing note.

**Parameters:**
- `file_path` (string, required): Path to the note
- `content` (string, required): Content to append

**Example:**
```python
result = await session.call_tool("append_to_note", {
    "file_path": "Journal/2026-02.md",
    "content": "\n\n## Feb 11\n\nToday I learned..."
})
```

### 7. delete_note
Delete a note from the vault.

**Parameters:**
- `file_path` (string, required): Path to the note

**Example:**
```python
result = await session.call_tool("delete_note", {
    "file_path": "Drafts/old-draft.md"
})
```

### 8. search_notes
Search notes in the vault using text search.

**Parameters:**
- `query` (string, required): Search query

**Example:**
```python
result = await session.call_tool("search_notes", {
    "query": "machine learning"
})
```

### 9. get_active_file
Get currently active file in Obsidian.

**Parameters:** None

**Example:**
```python
result = await session.call_tool("get_active_file", {})
```

### 10. get_tags
Get all tags used in the vault.

**Parameters:** None

**Example:**
```python
result = await session.call_tool("get_tags", {})
```

## Use Cases

### AI-Powered Note Taking
Use with AI agents to:
- Automatically create daily notes
- Summarize meeting notes
- Extract action items from notes
- Generate knowledge graphs from vault content

### Knowledge Management
- Search and retrieve information from your vault
- Create interconnected notes based on context
- Organize notes automatically
- Generate summaries and insights

### Task Management
- Extract and track todos across notes
- Create task lists dynamically
- Update project status
- Generate progress reports

## Security Notes

⚠️ **Important Security Considerations:**

1. **API Key Protection**: Never commit `.env` file with your API key
2. **Localhost Only**: The REST API runs on localhost (127.0.0.1)
3. **HTTPS**: Always use HTTPS even for localhost
4. **File Permissions**: Restrict access to `.env` file
   ```bash
   chmod 600 .env
   ```
5. **Vault Path**: Ensure the path points to the correct vault
6. **SSL Verification**: SSL verification is disabled for localhost connections

## Troubleshooting

### Connection Refused
**Problem:** Cannot connect to Obsidian REST API

**Solutions:**
- Verify Obsidian is running
- Check Local REST API plugin is enabled
- Verify port number (default: 27124)
- Check firewall settings

### Authentication Failed
**Problem:** 401 Unauthorized error

**Solutions:**
- Verify API key is correct
- Copy API key directly from plugin settings
- Check Authorization header format

### File Not Found
**Problem:** 404 error when accessing notes

**Solutions:**
- Verify file path is correct (relative to vault root)
- Check file extension (.md)
- Ensure file exists in the vault

### SSL Certificate Error
**Problem:** SSL verification errors

**Solutions:**
- The server disables SSL verification for localhost (this is safe)
- Ensure OBSIDIAN_BASE_URL uses `https://`
- Check Local REST API plugin SSL settings

## Development

### Project Structure

```
obsidian-mcp-server/
├── server.py                 # Main MCP server with SSE transport
├── obsidian_operations.py    # Obsidian REST API client
├── requirements.txt          # Python dependencies
├── .env.example              # Configuration template
└── README.md                # This file
```

### Testing

Create a test script to verify operations:

```python
from obsidian_operations import create_obsidian_client_from_env

client = create_obsidian_client_from_env()

# Test vault info
info = client.get_vault_info()
print("Vault info:", info)

# Test listing files
files = client.list_files()
print("Files:", files)

# Test search
results = client.search_notes("test")
print("Search results:", results)
```

## License

Same as the Budget Advisor project.

## References

- [Obsidian Local REST API Plugin](https://github.com/coddingtonbear/obsidian-local-rest-api)
- [Model Context Protocol (MCP)](https://github.com/anthropics/mcp)
- [Obsidian](https://obsidian.md/)
