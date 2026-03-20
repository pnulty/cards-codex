# Category 2 Cards Game

This project provides a lightweight FastAPI backend plus a small JavaScript frontend that lets a player draw one random card from each of the five Category 2 suits (Platform, Protocol, Tool, Touchstone, and Workshop).

## Getting Started

```bash
python -m venv .venv
.venv\Scripts\activate  # PowerShell on Windows
pip install -r requirements.txt
uvicorn backend.app:app --reload
```

Open http://127.0.0.1:8000 to use the web UI. The `/api/draw` endpoint returns JSON output that can also be consumed directly. Use the "Draw New Cards" button to refresh every suit at once, or redraw an individual suit with the per-card controls.

## Card Data Source

The app loads cards from a hard-coded Google Sheets CSV export URL.

If Google Sheets is unavailable at startup, the app falls back to the local `cards.tsv` file.

The current sheet is:

```bash
https://docs.google.com/spreadsheets/d/13ZuEqXz3gGgovGVP-714SsFIYh0He_e-jSVIg82A-zU/export?format=csv&gid=0
```

The sheet should expose the same headers as `cards.tsv`: `Category2`, `Name`, `Text`, `ShortText`, `URL`, and optional `ImageURL`.

When `ImageURL` is present, cards can be flipped in the UI to reveal the image.

## Shared Games

Use shared games when you want multiple people to see the same set of cards:

1. Click **Start Shared Game**.
2. Copy the generated `#/game/<id>` link and share it (e.g. in Zoom chat).
3. Anyone opening that link can redraw suits and everyone will stay in sync.

If you update the Google Sheet while the app is running, use the **Reload Cards** button to refresh the in-memory card data without redeploying.

Shared games are persisted in a small database (`cards.db` via SQLite by default). To use Postgres (for example on Render), set `DATABASE_URL` accordingly (both `postgres://...` and `postgresql://...` are supported; the app uses psycopg v3 under the hood).

## Deploying on Render

1. Push this repository to GitHub (or another Git provider that Render supports).
2. Create a new Render **Web Service**.
3. Use the following commands:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`
4. Select the Python environment (Render automatically detects it via `requirements.txt`).

Render will expose the FastAPI service at the generated URL, serving both the API and the static frontend.
