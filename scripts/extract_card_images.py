#!/usr/bin/env python3
"""Extract card-front images from the PowerPoint deck and map them to cards.tsv."""

from __future__ import annotations

import csv
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
PPTX_PATH = ROOT_DIR / "Final card deck edited proof pictures.pptx"
TSV_PATH = ROOT_DIR / "cards.tsv"
OUTPUT_DIR = ROOT_DIR / "frontend" / "assets" / "images" / "cards"
MANIFEST_PATH = ROOT_DIR / "card_image_manifest.csv"

XML_NAMESPACES = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}
SUITS = {"Platform", "Protocol", "Tool", "Touchstone", "Workshop"}


@dataclass
class CardRow:
    card_id: str
    suit: str
    name: str


@dataclass
class SlideImage:
    slide_number: int
    media_name: str
    media_bytes: bytes


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_value.lower()
    collapsed = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return collapsed or "card"


def load_card_rows() -> list[CardRow]:
    with TSV_PATH.open(encoding="utf-8") as cards_file:
        reader = csv.DictReader(cards_file, delimiter="\t")
        rows = [
            CardRow(
                card_id=(row.get("CardID", "").strip() or ""),
                suit=row.get("Category2", "").strip(),
                name=row.get("Name", "").strip(),
            )
            for row in reader
            if row.get("Category2", "").strip() and row.get("Name", "").strip()
        ]
    if not rows:
        raise RuntimeError("No card rows found in cards.tsv.")
    return rows


def iter_card_front_images() -> list[SlideImage]:
    with zipfile.ZipFile(PPTX_PATH) as archive:
        slide_names = sorted(
            (
                name
                for name in archive.namelist()
                if re.match(r"ppt/slides/slide\d+\.xml$", name)
            ),
            key=lambda name: int(re.search(r"(\d+)", name).group(1)),
        )

        slide_images: list[SlideImage] = []
        for slide_name in slide_names:
            slide_number = int(re.search(r"(\d+)", slide_name).group(1))
            root = ET.fromstring(archive.read(slide_name))
            texts = [
                node.text.strip()
                for node in root.findall(".//a:t", XML_NAMESPACES)
                if node.text and node.text.strip()
            ]

            if not texts or texts[0] not in SUITS:
                continue

            rel_name = f"ppt/slides/_rels/slide{slide_number}.xml.rels"
            rel_root = ET.fromstring(archive.read(rel_name))
            media_targets = [
                rel.attrib["Target"].split("../media/", 1)[1]
                for rel in rel_root
                if "../media/" in rel.attrib.get("Target", "")
            ]
            if not media_targets:
                raise RuntimeError(f"Slide {slide_number} looks like a card but has no image.")
            media_name = media_targets[0]
            media_path = f"ppt/media/{media_name}"
            slide_images.append(
                SlideImage(
                    slide_number=slide_number,
                    media_name=media_name,
                    media_bytes=archive.read(media_path),
                )
            )

    if not slide_images:
        raise RuntimeError("No card-front images were found in the PowerPoint deck.")

    return slide_images


def main() -> None:
    cards = load_card_rows()
    slide_images = iter_card_front_images()

    if len(cards) != len(slide_images):
        raise RuntimeError(
            f"Card/image count mismatch: cards.tsv has {len(cards)} rows, "
            f"PowerPoint yielded {len(slide_images)} card-front images."
        )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest_rows: list[dict[str, str]] = []
    for card, slide_image in zip(cards, slide_images):
        extension = Path(slide_image.media_name).suffix.lower()
        base_name = card.card_id or f"{slugify(card.suit)}-{slugify(card.name)}"
        filename = f"{slugify(base_name)}{extension}"
        output_path = OUTPUT_DIR / filename
        output_path.write_bytes(slide_image.media_bytes)

        manifest_rows.append(
            {
                "CardID": card.card_id,
                "Category2": card.suit,
                "Name": card.name,
                "SlideNumber": str(slide_image.slide_number),
                "SourceMedia": slide_image.media_name,
                "ImageURL": f"/assets/images/cards/{filename}",
            }
        )

    with MANIFEST_PATH.open("w", encoding="utf-8", newline="") as manifest_file:
        writer = csv.DictWriter(
            manifest_file,
            fieldnames=[
                "CardID",
                "Category2",
                "Name",
                "SlideNumber",
                "SourceMedia",
                "ImageURL",
            ],
        )
        writer.writeheader()
        writer.writerows(manifest_rows)

    print(f"Extracted {len(manifest_rows)} card images to {OUTPUT_DIR}")
    print(f"Wrote manifest to {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
