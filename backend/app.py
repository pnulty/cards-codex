"""FastAPI application that powers the cards drawing game."""

from __future__ import annotations

import csv
import random
from datetime import datetime
from pathlib import Path
from typing import Annotated, Dict, Iterable, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.database import get_session, init_db
from backend.models import Game, GameCard

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT_DIR / "cards.tsv"
FRONTEND_DIR = ROOT_DIR / "frontend"


class Card(BaseModel):
    id: str
    suit: str
    name: str
    short_text: str
    text: str
    url: Optional[str] = None


class DrawResponse(BaseModel):
    cards: Dict[str, Card]


class GameResponse(BaseModel):
    game_id: str
    cards: Dict[str, Card]


def _build_short_text(text: str, short_text: Optional[str], limit: int = 190) -> str:
    """Return a short summary, preferring the provided ShortText field."""
    if short_text:
        return short_text.strip()

    snippet = text.strip()
    if len(snippet) <= limit:
        return snippet

    truncated = snippet[:limit].rsplit(" ", 1)[0]
    return f"{truncated}..."


def load_cards() -> Dict[str, List[Card]]:
    """Read cards from the TSV file and bucket them by suit."""
    if not DATA_FILE.exists():
        raise FileNotFoundError(f"Cannot locate data file at {DATA_FILE}")

    suits: Dict[str, List[Card]] = {}
    with DATA_FILE.open(encoding="utf-8") as data_file:
        reader = csv.DictReader(data_file, delimiter="\t")
        for idx, row in enumerate(reader):
            suit = row.get("Category2", "").strip()
            name = row.get("Name", "").strip()
            text = row.get("Text", "").strip()
            short_text = row.get("ShortText", "").strip()
            url = row.get("URL", "").strip() or None

            if not suit or not name or not text:
                continue

            card = Card(
                id=str(idx),
                suit=suit,
                name=name,
                text=text,
                short_text=_build_short_text(text, short_text),
                url=url,
            )
            suits.setdefault(suit, []).append(card)

    if not suits:
        raise RuntimeError("No cards were loaded from the data file.")

    return suits


cards_by_suit = load_cards()
suit_lookup = {suit.lower(): suit for suit in cards_by_suit}


def _normalize_suit_name(value: str) -> str:
    """Return the canonical suit name, normalizing case and whitespace."""
    normalized = value.strip().lower()
    if not normalized:
        raise HTTPException(status_code=400, detail="Suit name cannot be empty")

    canonical = suit_lookup.get(normalized)
    if not canonical:
        raise HTTPException(status_code=404, detail=f"Suit '{value}' was not found")

    return canonical

app = FastAPI(
    title="Category 2 Cards Game",
    description="Draw one random card from each suit and explore the text.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


SuitQuery = Annotated[
    Optional[str],
    Query(
        description=(
            "Optional suit name. When provided, only a single suit is drawn."
        ),
    ),
]


def _choose_random_card(suit: str) -> Card:
    options = cards_by_suit.get(suit, [])
    if not options:
        raise HTTPException(
            status_code=500, detail=f"Not enough cards available in the '{suit}' suit"
        )
    return random.choice(options)


def _rows_to_cards(rows: Iterable[GameCard]) -> Dict[str, Card]:
    cards: Dict[str, Card] = {}
    for row in rows:
        cards[row.suit] = Card(
            id=row.card_id,
            suit=row.suit,
            name=row.name,
            short_text=row.short_text,
            text=row.text,
            url=row.url,
        )
    return cards


def _get_game_or_404(session: Session, game_id: str) -> Game:
    game = session.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail=f"Game '{game_id}' not found")
    return game


def _update_game_cards(session: Session, game: Game, suits: List[str]) -> Dict[str, Card]:
    now = datetime.utcnow()
    new_rows: List[GameCard] = []

    for suit_name in suits:
        suit = _normalize_suit_name(suit_name)
        card = _choose_random_card(suit)

        statement = select(GameCard).where(
            GameCard.game_id == game.id, GameCard.suit == suit
        )
        existing = session.exec(statement).one_or_none()

        if existing:
            existing.card_id = card.id
            existing.name = card.name
            existing.short_text = card.short_text
            existing.text = card.text
            existing.url = card.url
            existing.updated_at = now
        else:
            new_rows.append(
                GameCard(
                    game_id=game.id,
                    suit=suit,
                    card_id=card.id,
                    name=card.name,
                    short_text=card.short_text,
                    text=card.text,
                    url=card.url,
                    updated_at=now,
                )
            )

    if new_rows:
        session.add_all(new_rows)

    game.last_activity = now
    session.add(game)
    session.commit()

    return _get_cards_for_game(session, game.id)


def _get_cards_for_game(session: Session, game_id: str) -> Dict[str, Card]:
    rows = session.exec(select(GameCard).where(GameCard.game_id == game_id)).all()
    if not rows:
        return {}
    return _rows_to_cards(rows)


@app.on_event("startup")
def ensure_database() -> None:
    init_db()


@app.get("/api/draw", response_model=DrawResponse)
def draw_cards(suit: SuitQuery = None) -> DrawResponse:
    """Return one random card from each suit or a specific suit."""
    if not cards_by_suit:
        raise HTTPException(status_code=500, detail="Card data is not available")

    target_suits: List[str]
    if suit is None:
        target_suits = list(cards_by_suit.keys())
    else:
        target_suits = [_normalize_suit_name(suit)]

    drawn = {target: _choose_random_card(target) for target in target_suits}

    return DrawResponse(cards=drawn)


@app.post("/api/games", response_model=GameResponse)
def create_game(session: Session = Depends(get_session)) -> GameResponse:
    """Create a new shared game and pre-populate it with cards."""
    game = Game()
    session.add(game)
    session.commit()
    session.refresh(game)

    cards = _update_game_cards(session, game, list(cards_by_suit.keys()))
    return GameResponse(game_id=game.id, cards=cards)


@app.get("/api/games/{game_id}", response_model=GameResponse)
def get_game(game_id: str, session: Session = Depends(get_session)) -> GameResponse:
    """Return the stored cards for a shared game."""
    game = _get_game_or_404(session, game_id)
    cards = _get_cards_for_game(session, game.id)
    if not cards:
        cards = _update_game_cards(session, game, list(cards_by_suit.keys()))
    return GameResponse(game_id=game.id, cards=cards)


@app.post("/api/games/{game_id}/draw", response_model=GameResponse)
def draw_game_cards(
    game_id: str, suit: SuitQuery = None, session: Session = Depends(get_session)
) -> GameResponse:
    """Draw cards for a shared game, optionally limited to a single suit."""
    game = _get_game_or_404(session, game_id)
    suits = (
        list(cards_by_suit.keys())
        if suit is None
        else [_normalize_suit_name(suit)]
    )
    cards = _update_game_cards(session, game, suits)
    return GameResponse(game_id=game.id, cards=cards)


@app.get("/")
def serve_frontend() -> FileResponse:
    """Serve the single-page frontend."""
    index_file = FRONTEND_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Frontend build is missing")
    return FileResponse(index_file)


if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR), name="assets")
