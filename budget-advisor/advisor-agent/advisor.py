#!/usr/bin/env python3
"""
Budget Advisor Agent
Uses Ollama to analyze expense data from PostgreSQL MCP Server and generate financial advice
"""

import os
import sys
import json
import asyncio
import logging
from datetime import datetime
from typing import Optional

import ollama
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Configuration
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MCP_SERVER_SCRIPT = os.getenv("MCP_SERVER_SCRIPT", "../postgres-mcp-server/server.py")


class BudgetAdvisor:
    """Budget advisor that analyzes expenses using Ollama and MCP"""

    def __init__(self, ollama_model: str = OLLAMA_MODEL, ollama_host: str = OLLAMA_HOST):
        self.ollama_model = ollama_model
        self.ollama_host = ollama_host
        self.ollama_client = ollama.Client(host=ollama_host)
        self.session: Optional[ClientSession] = None

    async def connect_to_mcp_server(self):
        """Connect to the PostgreSQL MCP Server"""
        logger.info("Connecting to PostgreSQL MCP Server...")

        # Get database configuration from environment
        db_env = {
            "POSTGRES_HOST": os.getenv("POSTGRES_HOST", "localhost"),
            "POSTGRES_PORT": os.getenv("POSTGRES_PORT", "5432"),
            "POSTGRES_DB": os.getenv("POSTGRES_DB", "budget"),
            "POSTGRES_USER": os.getenv("POSTGRES_USER", "postgres"),
            "POSTGRES_PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
        }

        server_params = StdioServerParameters(
            command="python",
            args=[MCP_SERVER_SCRIPT],
            env=db_env
        )

        stdio_transport = await stdio_client(server_params)
        self.read_stream, self.write_stream = stdio_transport
        self.session = ClientSession(self.read_stream, self.write_stream)

        await self.session.initialize()
        logger.info("Connected to MCP server successfully")

    async def get_weekly_expenses(self, weeks_back: int = 0) -> dict:
        """Get weekly expense data from MCP server"""
        if not self.session:
            raise RuntimeError("Not connected to MCP server")

        logger.info(f"Fetching expenses for week {weeks_back} weeks ago...")

        result = await self.session.call_tool(
            "get_weekly_expenses",
            arguments={"weeks_back": weeks_back}
        )

        # Parse the JSON response
        if result.content and len(result.content) > 0:
            data = json.loads(result.content[0].text)
            return data
        return []

    async def get_monthly_summary(self, month: Optional[str] = None) -> dict:
        """Get monthly expense summary from MCP server"""
        if not self.session:
            raise RuntimeError("Not connected to MCP server")

        logger.info(f"Fetching monthly summary{f' for {month}' if month else ''}...")

        args = {"month": month} if month else {}
        result = await self.session.call_tool(
            "get_monthly_summary",
            arguments=args
        )

        # Parse the JSON response
        if result.content and len(result.content) > 0:
            data = json.loads(result.content[0].text)
            return data
        return []

    async def query_expenses(self, query: str) -> dict:
        """Execute custom SQL query via MCP server"""
        if not self.session:
            raise RuntimeError("Not connected to MCP server")

        logger.info(f"Executing custom query...")

        result = await self.session.call_tool(
            "query_expenses",
            arguments={"query": query}
        )

        # Parse the JSON response
        if result.content and len(result.content) > 0:
            data = json.loads(result.content[0].text)
            return data
        return []

    def generate_advice(self, weekly_data: list, monthly_data: list) -> str:
        """Generate financial advice using Ollama"""
        logger.info(f"Generating advice using {self.ollama_model}...")

        # Format the data for the prompt
        weekly_summary = self._format_weekly_data(weekly_data)
        monthly_summary = self._format_monthly_data(monthly_data)

        prompt = f"""You are a helpful financial advisor. Analyze the following expense data and provide personalized weekly financial advice.

WEEKLY EXPENSES (Current Week):
{weekly_summary}

MONTHLY SUMMARY (Current Month):
{monthly_summary}

Please provide:
1. A brief overview of spending patterns
2. Notable changes or concerns
3. 2-3 specific, actionable recommendations to improve financial health
4. One positive observation about their spending habits

Keep your advice concise, friendly, and actionable. Focus on practical tips they can implement this week.
"""

        # Call Ollama
        logger.info(f"Connecting to Ollama at {self.ollama_host}...")
        response = self.ollama_client.chat(
            model=self.ollama_model,
            messages=[
                {
                    'role': 'user',
                    'content': prompt
                }
            ]
        )

        advice = response['message']['content']
        logger.info("Advice generated successfully")
        return advice

    def _format_weekly_data(self, data: list) -> str:
        """Format weekly expense data for the prompt"""
        if not data:
            return "No expenses recorded this week."

        lines = []
        total = 0
        for item in data:
            category = item.get('category', 'Unknown')
            amount = float(item.get('total_amount', 0))
            count = item.get('transaction_count', 0)
            total += amount
            lines.append(f"- {category}: ${amount:.2f} ({count} transactions)")

        lines.append(f"\nTotal Weekly Spending: ${total:.2f}")
        return "\n".join(lines)

    def _format_monthly_data(self, data: list) -> str:
        """Format monthly expense data for the prompt"""
        if not data:
            return "No expenses recorded this month."

        lines = []
        total = 0
        for item in data:
            category = item.get('category', 'Unknown')
            amount = float(item.get('total_amount', 0))
            count = item.get('transaction_count', 0)
            avg = float(item.get('avg_amount', 0))
            total += amount
            lines.append(f"- {category}: ${amount:.2f} (avg: ${avg:.2f}, count: {count})")

        lines.append(f"\nTotal Monthly Spending: ${total:.2f}")
        return "\n".join(lines)

    async def close(self):
        """Close the MCP connection"""
        if self.session:
            await self.session.__aexit__(None, None, None)
            logger.info("Disconnected from MCP server")


async def main():
    """Main entry point"""
    print("=" * 70)
    print("Budget Advisor - Weekly Financial Advice")
    print("=" * 70)
    print()

    advisor = BudgetAdvisor()

    try:
        # Connect to MCP server
        await advisor.connect_to_mcp_server()

        # Get expense data
        weekly_expenses = await advisor.get_weekly_expenses(weeks_back=0)
        monthly_summary = await advisor.get_monthly_summary()

        # Generate advice
        advice = advisor.generate_advice(weekly_expenses, monthly_summary)

        # Display the advice
        print(advice)
        print()
        print("=" * 70)

    except Exception as e:
        logger.error(f"Error generating advice: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await advisor.close()


if __name__ == "__main__":
    asyncio.run(main())
