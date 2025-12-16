"""Database models for shared game storage."""

from __future__ import annotations

from datetime import datetime
import secrets
from typing import Optional

from sqlmodel import Field, SQLModel


def _game_id() -> str:
    return secrets.token_urlsafe(6)


class Game(SQLModel, table=True):
    id: str = Field(primary_key=True, default_factory=_game_id)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    last_activity: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class GameCard(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    game_id: str = Field(foreign_key="game.id", index=True)
    suit: str
    card_id: str
    name: str
    short_text: str
    text: str
    url: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
