# Value Engine

A value investing analysis web app for US and Hong Kong equities. It screens stocks by sector/index, calculates intrinsic value using DCF and Graham Number models, and tracks a personal portfolio's margin of safety.

## Architecture

Full-stack app with a Python backend and a Next.js frontend.

- **Backend:** FastAPI + Uvicorn, served on `http://localhost:8000`
- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4, served on `http://localhost:3000`
- **Data:** Yahoo Finance via `yfinance`, SEC EDGAR public API (`data.sec.gov`)
- **Portfolio Data:** Stored dynamically via backend in a local file at `portfolio/data.json`

## Dev Commands

```bash
# Backend (from /backend)
..\venv\Scripts\python -m uvicorn main:app --reload --port 8000

# Frontend (from /frontend)
npm run dev
```

## Key Files

| File | Purpose |
|---|---|
| `backend/api/routes.py` | All API endpoints (`/screen`, `/stock/{ticker}`, `/search`, `/portfolio`) |
| `backend/api/yahoo_client.py` | Fetches price, P/E, ROE, Op Margin, Rev Growth, PEG, FCF from Yahoo Finance |
| `backend/api/sec_client.py` | Resolves ticker → CIK, fetches XBRL company facts from SEC EDGAR |
| `backend/models/calculators.py` | DCF and Graham Number formulas |
| `backend/models/piotroski.py` | Piotroski F-Score (9-point scoring) |
| `frontend/src/app/screener/page.tsx` | Sector/ticker screener with server-side pagination and `sessionStorage` state |
| `frontend/src/app/analysis/[ticker]/page.tsx` | Deep-dive analysis and portfolio note interactions |
| `frontend/src/app/portfolio/page.tsx` | Portfolio tracker — loads history from `portfolio/data.json` and dynamically calculates DCF |

## API Overview

- `POST /api/data/screen` — batch screen entities (`ticker`, `sector`, `index`) with pagination (`page`, `limit`)
- `GET /api/data/stock/{ticker}` — full analysis for one ticker (Yahoo + SEC)
- `GET /api/data/search?q=&region=` — autocomplete for tickers, sectors, indices
- `GET/POST/DELETE /api/data/portfolio` — manages the local `portfolio/data.json` file storage

## Value Models

- **DCF:** 5 year projection, 5% growth, 10% discount rate, 10× terminal multiple (assumptions are interactive and recalculable on the Analysis frontend)
- **Graham Number:** `√(22.5 × EPS × BVPS)`
- **Margin of Safety:** `(intrinsic_value - price) / intrinsic_value × 100`

## Supported Markets

- **US equities** — tickers without a suffix (e.g. `AAPL`, `MSFT`)
- **HK equities** — tickers ending in `.HK` (e.g. `0700.HK`); SEC data is skipped for these

## Notes for AI Assistants

- Sector expansion paginates the Yahoo screener in batches of 250 (Yahoo's per-call max) using `yf.screener.screen(query, size=250, offset=N)` to collect all tickers before slicing for the page.
- The `piotroski.py` score is implemented but **not yet surfaced in the frontend**.
- CORS is configured to allow only `http://localhost:3000`.
- The Analysis page (`/analysis/[ticker]`) includes an "AI Investment Advice" block which automatically formats a markdown prompt with live fundamental data for pasting into LLMs.
