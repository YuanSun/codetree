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
├── budget-dashboard/       # Streamlit page: data table, receipt uploads, pivot views
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

### 3. Budget Dashboard

A Streamlit page for browsing expenses/income in a table, uploading receipts against existing rows, and building pivot-table style summaries.

See [budget-dashboard/README.md](budget-dashboard/README.md) for setup instructions.

### 4. Quick Start

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

## Testing

Run all tests across both components:

```bash
# Option 1: Using Python test runner (recommended)
python3 run_all_tests.py

# Option 2: Using Make
make test

# Run tests for individual components
make test-mcp       # PostgreSQL MCP Server only
make test-advisor   # Ollama Advisor only

# Run with coverage
make test-cov
```

**Test Results:**
- PostgreSQL MCP Server: 26 tests
- Ollama Advisor Agent: 16 tests (1 skipped)
- **Total: 42 unit tests, all passing ✓**

## Next Steps

- Add email/SMS notification service
- Implement weekly automation with scheduler
- Create historical tracking and trends

## Status

- ✅ PostgreSQL MCP Server implemented
- ✅ Ollama advisor agent implemented
- ✅ Budget dashboard (Streamlit) implemented
- ⏳ Notification service (pending)
- ⏳ Weekly automation (pending)
