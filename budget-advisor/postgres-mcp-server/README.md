# Budget Advisor - PostgreSQL MCP Server

A Model Context Protocol (MCP) server that provides access to budget and expense data stored in a PostgreSQL database.

## Features

- **Custom SQL Queries**: Execute SELECT queries to retrieve expense data
- **Weekly Expenses**: Get aggregated expenses for the current or past weeks
- **Monthly Summary**: Get monthly expense summaries with category breakdowns

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database with expense data
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure database connection:
```bash
cp .env.example .env
# Edit .env with your PostgreSQL credentials
```

3. Build the project:
```bash
npm run build
```

## Database Schema

This MCP server expects an `expenses` table with at least the following structure:

```sql
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT
);
```

You can extend this schema with additional columns as needed.

## Usage

### Running Standalone

Start the server:
```bash
npm start
```

### Using with Claude Desktop or Other MCP Clients

Add to your MCP client configuration (e.g., Claude Desktop config):

```json
{
  "mcpServers": {
    "budget-advisor-postgres": {
      "command": "node",
      "args": ["/path/to/budget-advisor/postgres-mcp-server/dist/index.js"],
      "env": {
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_DB": "budget",
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASSWORD": "your_password"
      }
    }
  }
}
```

## Available Tools

### 1. query_expenses

Execute custom SQL queries to retrieve expense data.

**Input:**
- `query` (string): SQL SELECT query to execute

**Example:**
```json
{
  "query": "SELECT * FROM expenses WHERE date >= CURRENT_DATE - INTERVAL '7 days' ORDER BY date DESC"
}
```

### 2. get_weekly_expenses

Get total expenses for the current or past weeks, grouped by category.

**Input:**
- `weeks_back` (number, optional): Number of weeks back from current week (default: 0)

**Example:**
```json
{
  "weeks_back": 0
}
```

### 3. get_monthly_summary

Get monthly expense summary with totals by category.

**Input:**
- `month` (string, optional): Month in YYYY-MM format (default: current month)

**Example:**
```json
{
  "month": "2024-12"
}
```

## Environment Variables

- `POSTGRES_HOST`: PostgreSQL server host (default: localhost)
- `POSTGRES_PORT`: PostgreSQL server port (default: 5432)
- `POSTGRES_DB`: Database name (default: budget)
- `POSTGRES_USER`: Database user (default: postgres)
- `POSTGRES_PASSWORD`: Database password (default: empty)

## Security

- Only SELECT queries are allowed through the `query_expenses` tool
- Connection pooling is used for efficient database connections
- Environment variables should be used for sensitive credentials

## Development

Run in development mode with auto-rebuild:
```bash
npm run dev
```

## Next Steps

This MCP server will be integrated with:
- Ollama for AI-powered financial analysis
- Email/SMS notification system for weekly advice
- Automated scheduling for weekly reports

## License

MIT
