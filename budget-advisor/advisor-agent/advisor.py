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
from datetime import datetime, timedelta
from typing import Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("Warning: python-dotenv not installed. Environment variables will not be loaded from .env file")

import ollama
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Configure logging with more detail
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FORMAT = os.getenv("LOG_FORMAT", '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s')

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format=LOG_FORMAT,
    handlers=[
        logging.StreamHandler(sys.stderr),
        # Optional: log to file as well
        # logging.FileHandler('advisor.log')
    ]
)
logger = logging.getLogger(__name__)

# Set log level for MCP client and server (can be noisy)
logging.getLogger('mcp').setLevel(logging.WARNING)
logging.getLogger('asyncio').setLevel(logging.WARNING)

logger.info(f"Logging initialized at {LOG_LEVEL} level")

# Configuration
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MCP_SERVER_SCRIPT = os.getenv("MCP_SERVER_SCRIPT", "../postgres-mcp-server/server.py")
PYTHON_CMD = os.getenv("PYTHON_CMD", sys.executable)  # Use current Python by default


class BudgetAdvisor:
    """Budget advisor that analyzes expenses using Ollama and MCP"""

    def __init__(self, ollama_model: str = OLLAMA_MODEL, ollama_host: str = OLLAMA_HOST):
        self.ollama_model = ollama_model
        self.ollama_host = ollama_host
        self.ollama_client = ollama.Client(host=ollama_host)
        self.session: Optional[ClientSession] = None
        self.stdio_context = None

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

        logger.debug(f"Database config: {db_env['POSTGRES_USER']}@{db_env['POSTGRES_HOST']}:{db_env['POSTGRES_PORT']}/{db_env['POSTGRES_DB']}")
        logger.debug(f"Python command: {PYTHON_CMD}")
        logger.debug(f"MCP server script: {MCP_SERVER_SCRIPT}")

        server_params = StdioServerParameters(
            command=PYTHON_CMD,
            args=[MCP_SERVER_SCRIPT],
            env=db_env
        )

        # Use async context manager properly
        logger.debug("Creating stdio client context...")
        self.stdio_context = stdio_client(server_params)
        logger.debug("Entering stdio context...")
        self.read_stream, self.write_stream = await self.stdio_context.__aenter__()

        logger.info("Initializing MCP client session...")

        # Create and start the session using async context manager
        # This properly handles the bidirectional message loop
        self.session = ClientSession(self.read_stream, self.write_stream)

        logger.debug("Starting MCP session context...")
        try:
            # First, enter the context to start message processing
            await asyncio.wait_for(self.session.__aenter__(), timeout=10.0)
            logger.debug("Session context started")

            # Then complete the MCP protocol handshake
            logger.debug("Completing MCP initialization handshake...")
            await asyncio.wait_for(self.session.initialize(), timeout=10.0)
            logger.info("Connected to MCP server successfully")
        except asyncio.TimeoutError:
            logger.error("Timeout during MCP session startup")
            raise RuntimeError("Failed to start MCP session: timeout")
        except Exception as e:
            logger.error(f"Error during MCP session startup: {e}")
            raise

    async def get_weekly_expenses(self, weeks_back: int = 0) -> dict:
        """Get weekly expense data from MCP server"""
        if not self.session:
            raise RuntimeError("Not connected to MCP server")

        logger.info(f"Fetching expenses for week {weeks_back} weeks ago...")
        logger.debug(f"Calling MCP tool: get_weekly_expenses with args: {{weeks_back: {weeks_back}}}")

        result = await self.session.call_tool(
            "get_weekly_expenses",
            arguments={"weeks_back": weeks_back}
        )

        # Parse the JSON response
        if result.content and len(result.content) > 0:
            data = json.loads(result.content[0].text)
            logger.debug(f"Received {len(data)} expense records")
            logger.debug(f"Data: {json.dumps(data, indent=2, default=str)}")
            return data
        logger.warning("No data returned from get_weekly_expenses")
        return []

    async def get_monthly_summary(self, month: Optional[str] = None) -> dict:
        """Get monthly expense summary from MCP server"""
        if not self.session:
            raise RuntimeError("Not connected to MCP server")

        logger.info(f"Fetching monthly summary{f' for {month}' if month else ''}...")
        args = {"month": month} if month else {}
        logger.debug(f"Calling MCP tool: get_monthly_summary with args: {args}")

        result = await self.session.call_tool(
            "get_monthly_summary",
            arguments=args
        )

        # Parse the JSON response
        if result.content and len(result.content) > 0:
            data = json.loads(result.content[0].text)
            logger.debug(f"Received {len(data)} category summaries")
            logger.debug(f"Data: {json.dumps(data, indent=2, default=str)}")
            return data
        logger.warning("No data returned from get_monthly_summary")
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

    async def answer_question(self, question: str) -> str:
        """Answer a question about expenses using Ollama with intelligent data fetching"""
        logger.info(f"Answering question: {question}")

        # First, ask Ollama to analyze the question and determine what data to fetch
        analysis_prompt = f"""You are a financial data analyst. Analyze this user question and determine what expense data is needed to answer it.

USER QUESTION: {question}

Respond with a JSON object specifying what data to fetch:
{{
  "time_periods": [
    {{"type": "current_week" | "current_month" | "last_month" | "specific_month", "value": "2024-07" (for specific_month)}},
    ...
  ],
  "is_comparison": true/false,
  "categories": ["Food", "Dining", etc] or null for all categories
}}

Examples:
- "How much did I spend on Food last month?" -> {{"time_periods": [{{"type": "last_month"}}], "is_comparison": false, "categories": ["Food"]}}
- "What did I spend this week?" -> {{"time_periods": [{{"type": "current_week"}}], "is_comparison": false, "categories": null}}
- "Compare July and August expenses" -> {{"time_periods": [{{"type": "specific_month", "value": "2024-07"}}, {{"type": "specific_month", "value": "2024-08"}}], "is_comparison": true, "categories": null}}
- "How does this month compare to last month?" -> {{"time_periods": [{{"type": "current_month"}}, {{"type": "last_month"}}], "is_comparison": true, "categories": null}}

Important: For month names (January, February, etc), use the current year and convert to YYYY-MM format.
Today's date is {datetime.now().strftime("%Y-%m-%d")} so use {datetime.now().year} for the year.

Only output the JSON, nothing else."""

        try:
            # Get data requirement analysis
            logger.debug("Analyzing question to determine data requirements...")
            analysis_response = self.ollama_client.chat(
                model=self.ollama_model,
                messages=[{'role': 'user', 'content': analysis_prompt}]
            )

            import json
            import re
            analysis_text = analysis_response['message']['content']
            # Extract JSON from response (in case model adds extra text)
            json_match = re.search(r'\{.*\}', analysis_text, re.DOTALL)
            if json_match:
                analysis = json.loads(json_match.group())
                logger.debug(f"Question analysis: {analysis}")
            else:
                logger.warning("Could not parse analysis JSON, using defaults")
                analysis = {
                    "time_periods": [{"type": "current_week"}],
                    "is_comparison": False,
                    "categories": None
                }

        except Exception as e:
            logger.warning(f"Error analyzing question: {e}, using default data fetch")
            analysis = {
                "time_periods": [{"type": "current_week"}],
                "is_comparison": False,
                "categories": None
            }

        # Fetch the appropriate data based on analysis
        try:
            data_context = []

            time_periods = analysis.get("time_periods", [{"type": "current_week"}])

            for period in time_periods:
                period_type = period.get("type")

                if period_type == "current_week":
                    weekly_data = await self.get_weekly_expenses(weeks_back=0)
                    data_context.append(("CURRENT WEEK", self._format_weekly_data(weekly_data)))

                elif period_type == "last_month":
                    # Get last month's data
                    last_month = (datetime.now().replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
                    monthly_data = await self.get_monthly_summary(month=last_month)
                    data_context.append((f"LAST MONTH ({last_month})", self._format_monthly_data(monthly_data)))

                elif period_type == "current_month":
                    monthly_data = await self.get_monthly_summary()
                    current_month = datetime.now().strftime("%Y-%m")
                    data_context.append((f"CURRENT MONTH ({current_month})", self._format_monthly_data(monthly_data)))

                elif period_type == "specific_month":
                    # Get specific month's data
                    month_value = period.get("value")
                    if month_value:
                        logger.debug(f"Fetching data for specific month: {month_value}")
                        monthly_data = await self.get_monthly_summary(month=month_value)
                        # Parse the month for a friendly name
                        try:
                            month_date = datetime.strptime(month_value, "%Y-%m")
                            month_name = month_date.strftime("%B %Y")  # e.g., "July 2024"
                        except:
                            month_name = month_value
                        data_context.append((f"{month_name.upper()}", self._format_monthly_data(monthly_data)))
                    else:
                        logger.warning(f"specific_month type but no value provided: {period}")

            # If no data was fetched, default to current week
            if not data_context:
                logger.warning("No data fetched, using default current week")
                weekly_data = await self.get_weekly_expenses(weeks_back=0)
                data_context.append(("CURRENT WEEK", self._format_weekly_data(weekly_data)))

        except Exception as e:
            logger.error(f"Error fetching data: {e}")
            import traceback
            traceback.print_exc()
            return "Sorry, I couldn't fetch your expense data. Please check the database connection."

        # Build context for answering
        context_text = "\n\n".join([f"{title}:\n{data}" for title, data in data_context])

        # Adjust the prompt based on whether it's a comparison
        if analysis.get("is_comparison") and len(data_context) > 1:
            answer_prompt = f"""You are a helpful financial advisor. The user is asking for a comparison between different time periods.

{context_text}

USER QUESTION: {question}

Provide a detailed comparison of the spending across these time periods. Include:
1. Total spending for each period
2. Key differences in spending patterns
3. Categories that increased or decreased
4. Specific recommendations based on the comparison

Be specific and use actual numbers from the data."""
        else:
            answer_prompt = f"""You are a helpful financial advisor with access to the user's expense data.
Answer their question based on the following data:

{context_text}

USER QUESTION: {question}

Provide a helpful, concise answer based on their actual expense data. Be specific and use actual numbers from the data.
If the question requires information not available in the data, politely explain what's available."""

        logger.debug(f"Answer prompt length: {len(answer_prompt)} characters")

        try:
            response = self.ollama_client.chat(
                model=self.ollama_model,
                messages=[{'role': 'user', 'content': answer_prompt}]
            )

            answer = response['message']['content']
            logger.info("Answer generated successfully")
            return answer
        except Exception as e:
            logger.error(f"Error calling Ollama: {e}")
            return f"Sorry, I encountered an error: {str(e)}"

    def generate_advice(self, weekly_data: list, monthly_data: list) -> str:
        """Generate financial advice using Ollama"""
        logger.info(f"Generating advice using {self.ollama_model}...")
        logger.debug(f"Weekly data entries: {len(weekly_data)}")
        logger.debug(f"Monthly data entries: {len(monthly_data)}")

        # Format the data for the prompt
        weekly_summary = self._format_weekly_data(weekly_data)
        monthly_summary = self._format_monthly_data(monthly_data)

        logger.debug(f"Formatted weekly summary:\n{weekly_summary}")
        logger.debug(f"Formatted monthly summary:\n{monthly_summary}")

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

        logger.debug(f"Prompt length: {len(prompt)} characters")

        # Call Ollama
        logger.info(f"Connecting to Ollama at {self.ollama_host}...")
        logger.debug(f"Using model: {self.ollama_model}")

        try:
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
            logger.debug(f"Advice length: {len(advice)} characters")
            return advice
        except Exception as e:
            logger.error(f"Error calling Ollama: {e}")
            raise

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
            try:
                await self.session.__aexit__(None, None, None)
            except Exception as e:
                logger.warning(f"Error closing session: {e}")
        if self.stdio_context:
            await self.stdio_context.__aexit__(None, None, None)
            logger.info("Disconnected from MCP server")


async def interactive_mode():
    """Interactive chat mode - ask questions in real-time"""
    print("=" * 70)
    print("Budget Advisor - Interactive Chat Mode")
    print("=" * 70)
    print()
    print("Ask me anything about your budget! Type /help for available commands.")
    print()

    advisor = BudgetAdvisor()

    try:
        # Connect to MCP server
        await advisor.connect_to_mcp_server()
        print("\n✓ Connected to your expense database\n", flush=True)

        # Chat loop
        while True:
            try:
                # Get user input
                user_input = input("You: ").strip()

                if not user_input:
                    continue

                # Handle commands
                if user_input.startswith('/'):
                    if user_input in ['/quit', '/exit', '/q']:
                        print("\nGoodbye! 👋")
                        break

                    elif user_input == '/help':
                        print("\nAvailable commands:")
                        print("  /weekly         - Show this week's expenses by category")
                        print("  /monthly        - Show this month's summary")
                        print("  /advice         - Get weekly financial advice")
                        print("  /help           - Show this help message")
                        print("  /quit or /exit  - Exit the chat")
                        print("\nOr just ask any question about your budget!")
                        print()
                        continue

                    elif user_input == '/weekly':
                        print("\nAdvisor: Fetching weekly expenses...\n")
                        weekly_data = await advisor.get_weekly_expenses(weeks_back=0)
                        print(advisor._format_weekly_data(weekly_data))
                        print()
                        continue

                    elif user_input == '/monthly':
                        print("\nAdvisor: Fetching monthly summary...\n")
                        monthly_data = await advisor.get_monthly_summary()
                        print(advisor._format_monthly_data(monthly_data))
                        print()
                        continue

                    elif user_input == '/advice':
                        print("\nAdvisor: Generating personalized advice...\n")
                        weekly_data = await advisor.get_weekly_expenses(weeks_back=0)
                        monthly_data = await advisor.get_monthly_summary()
                        advice = advisor.generate_advice(weekly_data, monthly_data)
                        print(advice)
                        print()
                        continue

                    else:
                        print(f"\nUnknown command: {user_input}")
                        print("Type /help for available commands.\n")
                        continue

                # Regular question - ask the AI
                print("\nAdvisor: ", end='', flush=True)
                answer = await advisor.answer_question(user_input)
                print(answer)
                print()

            except KeyboardInterrupt:
                print("\n\nGoodbye! 👋")
                break
            except EOFError:
                print("\n\nGoodbye! 👋")
                break
            except Exception as e:
                logger.error(f"Error in chat loop: {e}")
                print(f"\nSorry, something went wrong: {e}\n")

    except Exception as e:
        logger.error(f"Error in interactive mode: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await advisor.close()


async def weekly_advice_mode():
    """One-time weekly advice mode"""
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


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='Budget Advisor - AI-powered financial advice')
    parser.add_argument(
        '--mode',
        choices=['interactive', 'weekly'],
        default='interactive',
        help='Mode to run: interactive chat or one-time weekly advice (default: interactive)'
    )

    args = parser.parse_args()

    if args.mode == 'interactive':
        asyncio.run(interactive_mode())
    else:
        asyncio.run(weekly_advice_mode())


if __name__ == "__main__":
    main()
