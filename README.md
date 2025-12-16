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

## Deploying on Render

1. Push this repository to GitHub (or another Git provider that Render supports).
2. Create a new Render **Web Service**.
3. Use the following commands:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`
4. Select the Python environment (Render automatically detects it via `requirements.txt`).

Render will expose the FastAPI service at the generated URL, serving both the API and the static frontend.
