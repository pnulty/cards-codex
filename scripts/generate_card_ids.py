#!/usr/bin/env python3
"""Generate stable CardID values from cards.tsv."""

from __future__ import annotations

import csv
import re
import unicodedata
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
TSV_PATH = ROOT_DIR / "cards.tsv"
OUTPUT_PATH = ROOT_DIR / "card_ids.csv"


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_value.lower()
    collapsed = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return collapsed or "card"


def main() -> None:
    rows: list[dict[str, str]] = []
    seen: set[str] = set()

    with TSV_PATH.open(encoding="utf-8") as cards_file:
        reader = csv.DictReader(cards_file, delimiter="\t")
        for row in reader:
            suit = row.get("Category2", "").strip()
            name = row.get("Name", "").strip()
            if not suit or not name:
                continue

            card_id = f"{slugify(suit)}-{slugify(name)}"
            if card_id in seen:
                raise RuntimeError(f"Duplicate generated CardID: {card_id}")
            seen.add(card_id)

            rows.append(
                {
                    "CardID": card_id,
                    "Category2": suit,
                    "Name": name,
                }
            )

    with OUTPUT_PATH.open("w", encoding="utf-8", newline="") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=["CardID", "Category2", "Name"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} card IDs to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
