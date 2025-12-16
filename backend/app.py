"""FastAPI application that powers the cards drawing game."""

from __future__ import annotations

import csv
import random
from pathlib import Path
from typing import Annotated, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

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

    drawn: Dict[str, Card] = {}
    for target in target_suits:
        options = cards_by_suit.get(target, [])
        if not options:
            raise HTTPException(
                status_code=500,
                detail=f"Not enough cards available in the '{target}' suit",
            )
        drawn[target] = random.choice(options)

    return DrawResponse(cards=drawn)


@app.get("/")
def serve_frontend() -> FileResponse:
    """Serve the single-page frontend."""
    index_file = FRONTEND_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Frontend build is missing")
    return FileResponse(index_file)


if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR), name="assets")
