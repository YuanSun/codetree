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
├── advisor-agent/          # Ollama-based AI advisor
└── notification-service/   # Email/SMS notification service (coming soon)
```

## Getting Started

### 1. PostgreSQL MCP Server

The MCP server is now implemented and ready to connect to your PostgreSQL budget database.

See [postgres-mcp-server/README.md](postgres-mcp-server/README.md) for setup instructions.

### 2. Database Setup

You'll need to set up your PostgreSQL database with expense data. The MCP server expects an `expenses` table. See the database schema in the MCP server README.

### 2. Advisor Agent

The AI advisor uses Ollama to analyze your expense data and generate personalized financial advice.

See [advisor-agent/README.md](advisor-agent/README.md) for setup and usage instructions.

### 3. Quick Start

```bash
# 1. Set up PostgreSQL MCP Server
cd postgres-mcp-server
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your database credentials

# 2. Set up Advisor Agent
cd ../advisor-agent
pip install -r requirements.txt
ollama pull llama3.2  # Download Ollama model
cp .env.example .env
# Edit .env with your settings

# 3. Run the advisor
python advisor.py
```

## Next Steps

- Add email/SMS notification service
- Implement weekly automation with scheduler
- Create historical tracking and trends

## Status

- ✅ PostgreSQL MCP Server implemented
- ✅ Ollama advisor agent implemented
- ⏳ Notification service (pending)
- ⏳ Weekly automation (pending)
