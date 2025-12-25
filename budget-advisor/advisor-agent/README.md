# Budget Advisor Agent

An AI-powered financial advisor that analyzes your expense data using Ollama and provides personalized weekly financial advice.

## Features

- **MCP Integration**: Connects to the PostgreSQL MCP Server to fetch expense data
- **AI-Powered Analysis**: Uses Ollama (local LLM) to analyze spending patterns
- **Personalized Advice**: Generates actionable financial recommendations
- **Privacy-First**: All processing happens locally, no data sent to external services

## Prerequisites

- Python 3.10 or higher
- [Ollama](https://ollama.ai) installed and running
- PostgreSQL MCP Server (from `../postgres-mcp-server`)
- An Ollama model downloaded (e.g., `llama3.2`, `mistral`, `phi3`)

## Installation

### 1. Install Ollama

If you haven't already, install Ollama:

```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Or visit https://ollama.ai for other platforms
```

### 2. Download an Ollama Model

```bash
# Recommended: Llama 3.2 (3B parameters, fast and good quality)
ollama pull llama3.2

# Alternative options:
# ollama pull mistral     # 7B parameters
# ollama pull phi3        # 3.8B parameters
# ollama pull llama3.1    # 8B parameters
```

### 3. Install Python Dependencies

```bash
cd budget-advisor/advisor-agent

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

## Configuration

Edit `.env` to configure the advisor:

```bash
# Ollama model to use (must be downloaded via 'ollama pull')
OLLAMA_MODEL=llama3.2

# Ollama server URL (default: http://localhost:11434)
OLLAMA_HOST=http://localhost:11434

# For remote Ollama (e.g., another Mac on your network):
# OLLAMA_HOST=http://192.168.1.100:11434

# Path to MCP server script
MCP_SERVER_SCRIPT=../postgres-mcp-server/server.py

# Database credentials (passed to MCP server)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=budget
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
```

### Using Remote Ollama Instance

If you want to use Ollama running on another Mac in your network:

**On the Mac running Ollama:**

1. Configure Ollama to accept network connections:
```bash
# Set environment variable to listen on all interfaces
launchctl setenv OLLAMA_HOST 0.0.0.0:11434

# Restart Ollama
pkill ollama
ollama serve
```

Or, for persistent configuration, create/edit `~/.ollama/config`:
```bash
export OLLAMA_HOST=0.0.0.0:11434
```

2. Find your Mac's IP address:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# Or check System Settings > Network
```

**On the machine running the advisor:**

3. Update `.env` with the remote Ollama URL:
```bash
OLLAMA_HOST=http://192.168.1.100:11434  # Replace with your Mac's IP
```

4. Test the connection:
```bash
curl http://192.168.1.100:11434/api/tags
```

## Usage

### Basic Usage

Run the advisor to get weekly financial advice:

```bash
python advisor.py
```

This will:
1. Connect to the PostgreSQL MCP Server
2. Fetch your current week's expenses
3. Fetch your current month's summary
4. Generate personalized financial advice using Ollama
5. Display the advice

### Example Output

```
======================================================================
Budget Advisor - Weekly Financial Advice
======================================================================

Based on your spending this week, here's my analysis:

📊 SPENDING OVERVIEW
This week you spent $342.50 across 15 transactions, with groceries
($125.30) and dining ($98.75) being your largest categories...

⚠️  AREAS OF CONCERN
Your dining expenses are 28% higher than your monthly average. Consider
meal planning to reduce restaurant visits...

💡 RECOMMENDATIONS
1. Set a $75 weekly limit for dining out
2. Cook 2-3 meals at home this week to save $40-60
3. Review your streaming subscriptions - you're paying for 4 services

✨ WHAT YOU'RE DOING WELL
Great job keeping transportation costs low! Your gas spending is down
15% from last month.

======================================================================
```

### Running with Different Models

```bash
# Use a different Ollama model
OLLAMA_MODEL=mistral python advisor.py

# Or set it in .env
```

### Programmatic Usage

You can also use the BudgetAdvisor class in your own scripts:

```python
import asyncio
from advisor import BudgetAdvisor

async def get_advice():
    advisor = BudgetAdvisor(ollama_model="llama3.2")

    await advisor.connect_to_mcp_server()

    # Get data
    weekly = await advisor.get_weekly_expenses(weeks_back=0)
    monthly = await advisor.get_monthly_summary()

    # Generate advice
    advice = advisor.generate_advice(weekly, monthly)

    print(advice)

    await advisor.close()

asyncio.run(get_advice())
```

## How It Works

1. **Data Fetching**: The advisor connects to the PostgreSQL MCP Server and calls:
   - `get_weekly_expenses` - Gets current week's spending by category
   - `get_monthly_summary` - Gets monthly statistics

2. **Prompt Engineering**: Formats the expense data into a clear prompt for the LLM

3. **AI Analysis**: Sends the prompt to Ollama, which analyzes patterns and generates advice

4. **Output**: Displays personalized, actionable financial recommendations

## Customization

### Custom Prompts

You can customize the advice by editing the `generate_advice` method in `advisor.py`:

```python
prompt = f"""You are a financial advisor specializing in [YOUR FOCUS AREA]...
```

### Different Time Periods

Analyze different time periods:

```python
# Last week's expenses
weekly = await advisor.get_weekly_expenses(weeks_back=1)

# Specific month
monthly = await advisor.get_monthly_summary(month="2024-11")
```

### Custom Queries

Execute custom SQL queries:

```python
# Top 10 expenses this month
query = """
    SELECT date, category, amount, description
    FROM expenses
    WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
    ORDER BY amount DESC
    LIMIT 10
"""
results = await advisor.query_expenses(query)
```

## Troubleshooting

### "Connection refused" error

Make sure Ollama is running:
```bash
ollama serve
```

### "Model not found" error

Pull the model first:
```bash
ollama pull llama3.2
```

### MCP server connection fails

1. Check that the PostgreSQL MCP server works:
   ```bash
   cd ../postgres-mcp-server
   python -m pytest tests/
   ```

2. Verify database credentials in `.env`

### Slow response times

Try a smaller/faster model:
```bash
ollama pull phi3  # Smaller, faster model
OLLAMA_MODEL=phi3 python advisor.py
```

## Model Recommendations

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| llama3.2 | 3B | Fast | Good | Default choice |
| phi3 | 3.8B | Fast | Good | Quick responses |
| mistral | 7B | Medium | Better | More detailed advice |
| llama3.1 | 8B | Slower | Best | Comprehensive analysis |

## Next Steps

This advisor will be integrated with:
- **Notification Service**: Email/SMS delivery of weekly advice
- **Scheduler**: Automated weekly runs
- **Historical Analysis**: Track advice over time

## Security & Privacy

- All data stays local (Ollama runs on your machine)
- No data sent to external APIs
- Database credentials stored in `.env` (gitignored)
- MCP server enforces read-only access (SELECT only)

## License

MIT
