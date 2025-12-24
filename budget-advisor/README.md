# Budget Advisor

An AI-powered personal finance advisor that analyzes your budget data and provides weekly financial advice.

## Overview

This project uses:
- **Ollama**: Local AI model for analyzing financial data
- **PostgreSQL**: Database storing expense and budget data
- **MCP (Model Context Protocol)**: Connects AI model to database
- **Email/SMS**: Delivers weekly financial advice

## Project Structure

```
budget-advisor/
├── postgres-mcp-server/    # MCP server for PostgreSQL database access
├── advisor-agent/          # Ollama-based AI advisor (coming soon)
└── notification-service/   # Email/SMS notification service (coming soon)
```

## Getting Started

### 1. PostgreSQL MCP Server

The MCP server is now implemented and ready to connect to your PostgreSQL budget database.

See [postgres-mcp-server/README.md](postgres-mcp-server/README.md) for setup instructions.

### 2. Database Setup

You'll need to set up your PostgreSQL database with expense data. The MCP server expects an `expenses` table. See the database schema in the MCP server README.

### 3. Custom Queries

You can provide your own SQL queries to access expense data through the `query_expenses` tool, or use the built-in weekly and monthly summary tools.

## Next Steps

- Set up your PostgreSQL database with expense data
- Configure the MCP server with your database credentials
- Provide custom queries for accessing your specific expense data structure
- Implement the Ollama-based advisor agent
- Add email/SMS notification service

## Status

- ✅ PostgreSQL MCP Server implemented
- ⏳ Ollama advisor agent (pending)
- ⏳ Notification service (pending)
- ⏳ Weekly automation (pending)
