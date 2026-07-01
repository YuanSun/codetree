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
import re
import uuid
import logging
from typing import Any, Optional

import pandas as pd
import psycopg2
from psycopg2 import pool

logger = logging.getLogger(__name__)

DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "database": os.getenv("POSTGRES_DB", "budget"),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", ""),
}

ATTACHMENT_STORAGE_DIR = os.getenv("ATTACHMENT_STORAGE_DIR", "./uploads")

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
               attachment, expense_numeric
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


def update_expense_attachment(row_id: int, path: str) -> None:
    _execute(
        'UPDATE family_budget."DailyExpense" SET attachment = %s WHERE id = %s;',
        (path, row_id),
    )


def update_income_attachment(row_id: int, path: str) -> None:
    """
    incomevw does not expose an attachment column (Incomes has no such
    column today); this raises until/unless Incomes gains one. Kept as a
    separate function so callers don't need to special-case income vs
    expense at the call site.
    """
    raise NotImplementedError(
        "family_budget.Incomes has no attachment column; only expenses support attachments today."
    )


_SAFE_CHARS = re.compile(r"[^A-Za-z0-9._-]+")


def _sanitize_filename(filename: str) -> str:
    """Strip directory components and unsafe characters from a filename."""
    base = os.path.basename(filename or "upload")
    base = _SAFE_CHARS.sub("_", base)
    return base or "upload"


def save_uploaded_file(uploaded_file, row_id: int, category: str = "expense") -> str:
    """
    Persist an uploaded file under ATTACHMENT_STORAGE_DIR/{category}/{row_id}/
    and return the relative path to store in the attachment column.
    """
    safe_name = _sanitize_filename(uploaded_file.name)
    unique_name = f"{uuid.uuid4().hex[:8]}_{safe_name}"

    target_dir = os.path.join(ATTACHMENT_STORAGE_DIR, category, str(row_id))
    os.makedirs(target_dir, exist_ok=True)

    relative_path = os.path.join(category, str(row_id), unique_name)
    absolute_path = os.path.join(ATTACHMENT_STORAGE_DIR, relative_path)

    with open(absolute_path, "wb") as f:
        f.write(uploaded_file.getbuffer())

    return relative_path
