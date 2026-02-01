"""
Shared database operations for Budget Advisor MCP Server.
Contains database connection pooling and query functions used by both
stdio (server.py) and HTTP (server_http.py) MCP servers.
"""

import os
import logging
from typing import Any, Optional
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

# Database configuration from environment variables
DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "database": os.getenv("POSTGRES_DB", "budget"),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", ""),
}

# Connection pool (initialized by init_database)
connection_pool = None


def init_database():
    """Initialize database connection pool"""
    global connection_pool
    try:
        connection_pool = pool.SimpleConnectionPool(
            1,  # minconn
            10,  # maxconn
            **DB_CONFIG
        )
        logger.info("Database connection pool initialized")
    except Exception as e:
        logger.error(f"Failed to initialize database pool: {e}")
        raise


def get_connection():
    """Get a connection from the pool"""
    if connection_pool is None:
        raise RuntimeError("Database pool not initialized. Call init_database() first.")
    return connection_pool.getconn()


def release_connection(conn):
    """Return a connection to the pool"""
    if connection_pool is not None:
        connection_pool.putconn(conn)


def close_all_connections():
    """Close all database connections in the pool"""
    global connection_pool
    if connection_pool:
        connection_pool.closeall()
        logger.info("Database connections closed")
        connection_pool = None


def execute_query(query: str) -> list[dict[str, Any]]:
    """
    Execute a SELECT query and return results.

    Args:
        query: SQL query to execute (only SELECT queries allowed)

    Returns:
        List of dictionaries representing query results

    Raises:
        ValueError: If query is not a SELECT statement
    """
    # Security: Only allow SELECT queries
    if not query.strip().upper().startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed")

    conn = None
    try:
        conn = get_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query)
            results = cursor.fetchall()
            # Convert RealDictRow to regular dict
            return [dict(row) for row in results]
    finally:
        if conn:
            release_connection(conn)


def get_weekly_expenses(weeks_back: int = 0) -> list[dict[str, Any]]:
    """
    Get total expenses for the current or past weeks, grouped by category.

    Args:
        weeks_back: Number of weeks back from current week (0 = current week, 1 = last week, etc.)

    Returns:
        List of expense records with category, total_amount, transaction_count, and week_start
    """
    query = f"""
        Select "typeName" as category, sum("expense_numeric") as total_amount, count(*) as transaction_count, DATE_TRUNC('week', date) as week_start
        from family_budget.dailyexpensevw
            where date >= DATE_TRUNC('week', CURRENT_DATE - interval '{weeks_back} weeks')
            and date < DATE_TRUNC('week', CURRENT_DATE - INTERVAL '{weeks_back - 1} weeks')
        group by category, DATE_TRUNC('week', date)
        order by total_amount desc;
    """
    logger.info("Run weekly expense query")
    return execute_query(query)


def get_monthly_summary(month: Optional[str] = None) -> list[dict[str, Any]]:
    """
    Get monthly expense summary with totals by category.

    Args:
        month: Month in YYYY-MM format (e.g., '2024-07'). If not provided, uses current month.

    Returns:
        List of expense summaries with category, total_amount, transaction_count, avg_amount, min_amount, max_amount
    """
    if month:
        month_condition = f"DATE_TRUNC('month', date) = DATE_TRUNC('month', '{month}-01'::date)"
    else:
        month_condition = "DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)"

    query = f"""
        SELECT
            "typeName" as category,
            SUM(expense_numeric) as total_amount,
            COUNT(*) as transaction_count,
            AVG(expense_numeric)::numeric(10, 2) as avg_amount,
            MIN(expense_numeric) as min_amount,
            MAX(expense_numeric) as max_amount
        FROM family_budget.dailyexpensevw
        WHERE {month_condition}
        GROUP BY category
        ORDER BY total_amount DESC;
    """
    return execute_query(query)


def get_monthly_grouped_expenses(target_year: int, target_month: int) -> list[dict[str, Any]]:
    """
    Get grouped monthly expenses by category for a specific year and month.

    Args:
        target_year: Year (e.g., 2024)
        target_month: Month (1-12)

    Returns:
        List of expense records with typeName and total_expense, ordered by total descending
    """
    query = f"""
        SELECT
            "typeName",
            SUM("expense_numeric") AS total_expense
        FROM family_budget.dailyexpensevw
        WHERE
            EXTRACT(YEAR FROM "date") = {target_year}
            AND EXTRACT(MONTH FROM "date") = {target_month}
        GROUP BY "typeName"
        ORDER BY total_expense DESC;
    """
    logger.info(f"Fetching grouped monthly expenses for {target_year}-{target_month:02d}")
    return execute_query(query)


def get_monthly_detailed_expenses(target_year: int, target_month: int) -> list[dict[str, Any]]:
    """
    Get detailed transaction-level monthly expenses for a specific year and month.

    Args:
        target_year: Year (e.g., 2024)
        target_month: Month (1-12)

    Returns:
        List of detailed expense records with all transaction information, ordered by typeName and date
    """
    query = f"""
        SELECT
            "typeName",
            "date",
            "expense",
            "merchantName",
            "merchantCity",
            "merchantStateOrProvince",
            "merchantCountry",
            "comment",
            "attachment",
            "expense_numeric"
        FROM family_budget.dailyexpensevw
        WHERE
            EXTRACT(YEAR FROM "date") = {target_year}
            AND EXTRACT(MONTH FROM "date") = {target_month}
        ORDER BY "typeName", "date";
    """
    logger.info(f"Fetching detailed monthly expenses for {target_year}-{target_month:02d}")
    return execute_query(query)


def get_valid_type_names() -> list[str]:
    """
    Get list of valid expense type names (categories) from MerchantType table.

    Returns:
        List of valid typeName strings
    """
    query = """
        SELECT "typeName"
        FROM family_budget."MerchantType"
        ORDER BY "typeName";
    """
    results = execute_query(query)
    return [row['typeName'] for row in results]


def get_expenses_by_category(target_year: int, target_month: int, type_name: str) -> list[dict[str, Any]]:
    """
    Get all expenses for a specific category (typeName), year, and month.
    Validates that the typeName exists in MerchantType table before querying.

    Args:
        target_year: Year (e.g., 2024)
        target_month: Month (1-12)
        type_name: Category name (must exist in MerchantType table)

    Returns:
        List of all expense records matching the category, year, and month

    Raises:
        ValueError: If type_name is not a valid category
    """
    # Validate typeName
    valid_types = get_valid_type_names()
    if type_name not in valid_types:
        raise ValueError(
            f"Invalid typeName: '{type_name}'. Valid types are: {', '.join(valid_types)}"
        )

    # Query expenses for this category
    query = f"""
        SELECT *
        FROM family_budget.dailyexpensevw
        WHERE
            "typeName" = '{type_name}'
            AND EXTRACT(YEAR FROM "date") = {target_year}
            AND EXTRACT(MONTH FROM "date") = {target_month}
        ORDER BY "date";
    """
    logger.info(f"Fetching {type_name} expenses for {target_year}-{target_month:02d}")
    return execute_query(query)
