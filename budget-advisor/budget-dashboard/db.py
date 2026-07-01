"""
Database access layer for the Budget Dashboard Streamlit app.

Talks directly to the family_budget Postgres schema (dailyexpensevw /
incomevw and the underlying DailyExpense / Incomes tables). This module is
self-contained and does not share connections with postgres-mcp-server.

All queries are parameterized (psycopg2 %s placeholders) since, unlike the
MCP server's canned reports, this app accepts free-form filter input from a
UI and must not build SQL via string interpolation.
"""

import os
import logging
from typing import Any, Optional

import pandas as pd
import psycopg2
import psycopg2.extensions
from psycopg2 import pool

logger = logging.getLogger(__name__)

# Postgres NUMERIC/DECIMAL columns (expense_numeric, income_numeric) come back
# as decimal.Decimal by default, which pandas stores as an opaque object dtype
# that Altair can't map to a vegalite type (it silently falls back to
# "nominal", breaking numeric encodings like pie/bar charts). Cast them to
# float at the driver level so every DataFrame gets proper numeric dtypes.
psycopg2.extensions.register_type(
    psycopg2.extensions.new_type(
        psycopg2.extensions.DECIMAL.values,
        "DEC2FLOAT",
        lambda value, curs: float(value) if value is not None else None,
    )
)

DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "database": os.getenv("POSTGRES_DB", "budget"),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", ""),
}

_connection_pool: Optional[pool.SimpleConnectionPool] = None


def _get_pool() -> pool.SimpleConnectionPool:
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = pool.SimpleConnectionPool(1, 10, **DB_CONFIG)
        logger.info("Database connection pool initialized")
    return _connection_pool


def _query_df(query: str, params: tuple = ()) -> pd.DataFrame:
    """Run a parameterized SELECT and return a DataFrame."""
    conn = _get_pool().getconn()
    try:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
        return pd.DataFrame(rows, columns=columns)
    finally:
        _get_pool().putconn(conn)


def _execute(query: str, params: tuple = ()) -> None:
    """Run a parameterized write statement and commit."""
    conn = _get_pool().getconn()
    try:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _get_pool().putconn(conn)


def _build_filter_clause(
    filters: dict[str, Any],
    date_column: str,
    type_column: str,
    name_column: str,
    country_column: str,
) -> tuple[str, tuple]:
    """
    Build a parameterized WHERE clause from a filters dict.

    Recognized keys: start_date, end_date, types (list[str]), name_search (str),
    country (str). Returns (clause, params) where clause is either "" or
    "WHERE ...".
    """
    clauses = []
    params: list[Any] = []

    if filters.get("start_date"):
        clauses.append(f'"{date_column}" >= %s')
        params.append(filters["start_date"])
    if filters.get("end_date"):
        clauses.append(f'"{date_column}" <= %s')
        params.append(filters["end_date"])
    if filters.get("types"):
        placeholders = ", ".join(["%s"] * len(filters["types"]))
        clauses.append(f'"{type_column}" IN ({placeholders})')
        params.extend(filters["types"])
    if filters.get("name_search"):
        clauses.append(f'"{name_column}" ILIKE %s')
        params.append(f"%{filters['name_search']}%")
    if filters.get("country"):
        clauses.append(f'"{country_column}" = %s')
        params.append(filters["country"])

    if not clauses:
        return "", ()
    return "WHERE " + " AND ".join(clauses), tuple(params)


def fetch_expenses(filters: Optional[dict[str, Any]] = None) -> pd.DataFrame:
    filters = filters or {}
    clause, params = _build_filter_clause(
        filters,
        date_column="date",
        type_column="typeName",
        name_column="merchantName",
        country_column="merchantCountry",
    )
    query = f"""
        SELECT id, date, expense, "merchantName", "typeName", "merchantCity",
               "merchantStateOrProvince", "merchantCountry", comment,
               octet_length(attachment) AS attachment_size, expense_numeric
        FROM family_budget.dailyexpensevw
        {clause}
        ORDER BY date DESC, id DESC;
    """
    return _query_df(query, params)


def fetch_income(filters: Optional[dict[str, Any]] = None) -> pd.DataFrame:
    filters = filters or {}
    clause, params = _build_filter_clause(
        filters,
        date_column="date",
        type_column="typeName",
        name_column="sourceName",
        country_column="sourceCountry",
    )
    query = f"""
        SELECT id, date, income, "sourceName", "typeName", "sourceCity",
               "sourceStateOrProvince", "sourceCountry", comment, income_numeric
        FROM family_budget.incomevw
        {clause}
        ORDER BY date DESC, id DESC;
    """
    return _query_df(query, params)


def get_expense_types() -> list[str]:
    df = _query_df('SELECT DISTINCT "typeName" FROM family_budget.dailyexpensevw ORDER BY "typeName";')
    return df["typeName"].tolist()


def get_income_types() -> list[str]:
    df = _query_df('SELECT DISTINCT "typeName" FROM family_budget.incomevw ORDER BY "typeName";')
    return df["typeName"].tolist()


def get_balance_years() -> list[int]:
    """
    Discover which family_budget.balance_{year}_vw views exist by introspecting
    the schema, rather than assuming a fixed year range.
    """
    df = _query_df(
        """
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'family_budget' AND table_name ~ '^balance_[0-9]{4}_vw$'
        ORDER BY table_name;
        """
    )
    return sorted(int(name.split("_")[1]) for name in df["table_name"])


def fetch_balance(year: int) -> pd.DataFrame:
    """
    Fetch the monthly expense/income/balance breakdown from
    family_budget.balance_{year}_vw. The view name can't be parameterized
    like a normal query value, so validate year is a plain 4-digit int
    before interpolating it (it should also only ever come from
    get_balance_years(), which reads real view names from the schema).
    """
    if not isinstance(year, int) or not (1000 <= year <= 9999):
        raise ValueError(f"Invalid year: {year!r}")
    query = f"""
        SELECT month, expense, income, balance
        FROM family_budget.balance_{year}_vw
        ORDER BY month;
    """
    return _query_df(query)


def update_expense_fields(row_id: str, date_value, amount: float, comment: str) -> None:
    """
    Update the editable fields that belong directly to DailyExpense (not the
    shared merchant lookup tables): date, expense_numeric, comment.
    """
    _execute(
        'UPDATE family_budget."DailyExpense" SET date = %s, expense_numeric = %s, comment = %s WHERE id = %s;',
        (date_value, amount, comment, row_id),
    )


def update_expense_attachment(row_id: str, file_bytes: bytes) -> None:
    """Store the uploaded file's raw bytes directly in the bytea attachment column."""
    _execute(
        'UPDATE family_budget."DailyExpense" SET attachment = %s WHERE id = %s;',
        (psycopg2.Binary(file_bytes), row_id),
    )


def get_expense_attachment(row_id: str) -> Optional[bytes]:
    """Fetch the raw attachment bytes for a single expense row, if any."""
    conn = _get_pool().getconn()
    try:
        with conn.cursor() as cursor:
            cursor.execute('SELECT attachment FROM family_budget."DailyExpense" WHERE id = %s;', (row_id,))
            row = cursor.fetchone()
        return bytes(row[0]) if row and row[0] is not None else None
    finally:
        _get_pool().putconn(conn)


def update_income_attachment(row_id: str, file_bytes: bytes) -> None:
    """
    incomevw does not expose an attachment column (Incomes has no such
    column today); this raises until/unless Incomes gains one. Kept as a
    separate function so callers don't need to special-case income vs
    expense at the call site.
    """
    raise NotImplementedError(
        "family_budget.Incomes has no attachment column; only expenses support attachments today."
    )
