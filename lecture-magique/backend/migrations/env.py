"""Alembic env. Migrations run with DATABASE_ADMIN_URL (the app role cannot create tables).

The version table lives in the lecture schema too, so the migration never writes to public.
"""
from alembic import context
from sqlalchemy import create_engine, text

from app.config import settings

url = context.config.get_main_option("sqlalchemy.url") or settings.admin_url


def run() -> None:
    engine = create_engine(url)
    with engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS lecture"))
        conn.commit()
        context.configure(connection=conn, version_table_schema="lecture", transaction_per_migration=True)
        with context.begin_transaction():
            context.run_migrations()
        conn.commit()


if context.is_offline_mode():
    context.configure(url=url, literal_binds=True, version_table_schema="lecture")
    with context.begin_transaction():
        context.run_migrations()
else:
    run()
