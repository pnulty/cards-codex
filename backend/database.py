"""Database utilities for the cards game."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SQLITE_URL = f"sqlite:///{ROOT_DIR / 'cards.db'}"


def _normalize_database_url(database_url: str) -> str:
    """Normalize the DATABASE_URL so SQLAlchemy picks the installed driver.

    Render/Heroku style URLs often start with `postgres://` (or `postgresql://`),
    which defaults to the psycopg2 driver. This project uses psycopg (v3), so we
    rewrite to the explicit `postgresql+psycopg://` scheme.
    """
    url = database_url.strip()
    if url.startswith("postgresql+"):
        return url
    if url.startswith("postgres://"):
        return f"postgresql+psycopg://{url[len('postgres://'):]}"
    if url.startswith("postgresql://"):
        return f"postgresql+psycopg://{url[len('postgresql://'):]}"
    return url


def _build_engine() -> Engine:
    database_url = _normalize_database_url(os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL))
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    return create_engine(database_url, connect_args=connect_args)


engine = _build_engine()


def _ensure_game_card_columns() -> None:
    """Apply lightweight schema updates for existing deployments."""
    inspector = inspect(engine)
    if "gamecard" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("gamecard")}
    statements: list[str] = []

    if "image_url" not in columns:
        statements.append("ALTER TABLE gamecard ADD COLUMN image_url VARCHAR")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def init_db() -> None:
    """Create database tables if they do not exist."""
    from . import models  # noqa: F401 -- ensures models are registered

    SQLModel.metadata.create_all(engine)
    _ensure_game_card_columns()


def get_session() -> Iterator[Session]:
    """FastAPI dependency that yields a SQLModel session."""
    with Session(engine) as session:
        yield session
