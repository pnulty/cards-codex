# Session Notes

## Current Hosting

- GitHub repo: `pnulty/cards-codex`
- Render is used for hosting
- Render deploys are manual, not auto-deploy

## Card Data Source

- The app reads card data from a hard-coded Google Sheets CSV export URL in `backend/app.py`
- If Google Sheets is unavailable at startup, the app falls back to local `cards.tsv`
- The live sheet now uses:
  - `CardID`
  - `Category1`
  - `Category2`
  - `Name`
  - `Text`
  - `ShortText`
  - `URL`
  - `SourceMedia`
  - `ImageURL`

## Important Runtime Behavior

- Card data is cached in memory on app startup
- The `Reload Cards` button calls `POST /api/cards/reload`
- After sheet edits, use `Reload Cards` and then redraw cards
- A browser hard refresh may be needed after frontend deploys because asset URLs are stable

## Images

- Served image paths must be under `frontend/images/cards/`
- Public URLs used by the app look like `/assets/images/cards/<filename>`
- The previous `frontend/assets/images/cards/` path was wrong and has been fixed

## Extraction Scripts

- `scripts/generate_card_ids.py`
  - Generates `card_ids.csv` from `cards.tsv`
- `scripts/extract_card_images.py`
  - Extracts card-front images from the PowerPoint deck
  - Writes images to `frontend/images/cards/`
  - Writes `card_image_manifest.csv`

## Source Deck

- Source PowerPoint used for image extraction:
  - `Final card deck edited proof pictures.pptx`
- It is intentionally ignored by git and not committed

## UI State

- Cards support:
  - manual reload
  - image flip interaction
  - `Peel back` / `Fold away` text toggle
- Current layout keeps `Draw this suit` near the top and text/image controls lower down
