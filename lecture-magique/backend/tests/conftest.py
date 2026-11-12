"""Test database setup.

Tests run against TEST_DATABASE_URL (default: a local database named lecture_test).
They drop and recreate the lecture schema, so they refuse any database that holds the real
data (one with a family_budget schema).
On the Mac:  docker run -d --name lecture-pg -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:16
             TEST_DATABASE_URL=postgresql+psycopg://postgres:test@localhost:55432/lecture_test uv run pytest
"""
import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

TEST_URL = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://postgres@localhost:5432/lecture_test")
if make_url(TEST_URL).database in ("family_budget", "postgres"):
    raise RuntimeError("Refusing to run tests in the 'postgres' database: point TEST_DATABASE_URL at e.g. /lecture_test")

os.environ["DATABASE_URL"] = TEST_URL
os.environ["DATABASE_ADMIN_URL"] = TEST_URL
os.environ.setdefault("SESSION_SECRET", "test-secret")

from app import config  # noqa: E402

config.settings.database_url = TEST_URL
config.settings.admin_url = TEST_URL
config.settings.session_secret = "test-secret"


def _ensure_database() -> None:
    url = make_url(TEST_URL)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        if not c.execute(text("SELECT 1 FROM pg_database WHERE datname=:d"), {"d": url.database}).first():
            c.execute(text(f'CREATE DATABASE "{url.database}"'))
    admin.dispose()


@pytest.fixture(scope="session")
def engine():
    from alembic import command
    from alembic.config import Config

    _ensure_database()
    raw = create_engine(TEST_URL)
    with raw.connect() as c:
        if c.execute(text("SELECT 1 FROM information_schema.schemata WHERE schema_name = 'family_budget'")).first():
            raise RuntimeError(f"Refusing to run tests: {make_url(TEST_URL).database} has a family_budget schema "
                               "(real data). Use a separate test database.")
    with raw.begin() as c:
        c.execute(text("DROP SCHEMA IF EXISTS lecture CASCADE"))
    raw.dispose()
    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "migrations"))
    cfg.set_main_option("sqlalchemy.url", TEST_URL)
    command.upgrade(cfg, "head")

    from app.db import get_engine

    get_engine.cache_clear()
    eng = get_engine()
    yield eng
    eng.dispose()


USER_TABLES = "lookup_event, user_word, reading_progress, reading_day, review_log, answer, quiz_item, quiz, app_user"
CONTENT_TABLES = "token, paragraph, chapter, question, article, word_form, sense, lemma"


@pytest.fixture
def db(engine):
    """Empty tables before each test."""
    with engine.begin() as c:
        c.execute(text(f"TRUNCATE {USER_TABLES}, {CONTENT_TABLES} RESTART IDENTITY CASCADE"))
    return engine
