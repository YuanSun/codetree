"""Database engine. Every connection pins search_path=lecture so nothing ever lands in public."""
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Connection, Engine, create_engine

from .config import settings


@lru_cache
def get_engine(url: str | None = None) -> Engine:
    return create_engine(
        url or settings.database_url,
        pool_pre_ping=True,
        connect_args={"options": "-csearch_path=lecture"},
    )


def get_conn() -> Iterator[Connection]:
    """FastAPI dependency: one transaction per request."""
    with get_engine().begin() as conn:
        yield conn
