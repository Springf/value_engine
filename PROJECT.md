# Value Engine — Project Documentation

> A value investing analysis platform for US and Hong Kong equities. Calculates intrinsic value, screens sectors, and tracks portfolio margin of safety.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Backend | FastAPI (Python), Uvicorn |
| Data Sources | Yahoo Finance (`yfinance`), SEC EDGAR API |
| UI Libraries | `lucide-react`, `recharts`, `axios` |

---

## Project Structure

```
value_engine/
├── backend/
│   ├── main.py                  # FastAPI app entry point, CORS config
│   ├── requirements.txt
│   ├── api/
│   │   ├── routes.py            # All API route handlers
│   │   ├── yahoo_client.py      # Yahoo Finance data fetcher
│   │   └── sec_client.py        # SEC EDGAR API client
│   └── models/
│       ├── calculators.py       # DCF & Graham Number calculators
│       └── piotroski.py         # Piotroski F-Score calculator
└── frontend/
    └── src/app/
        ├── layout.tsx           # Root layout with nav header
        ├── page.tsx             # Dashboard / landing page
        ├── screener/
        │   ├── page.tsx         # Stock screener page
        │   └── autocomplete.tsx # Search autocomplete component
        ├── analysis/
        │   ├── page.tsx         # Analysis search landing
        │   └── [ticker]/page.tsx # Deep-dive analysis for a ticker
        └── portfolio/
            └── page.tsx         # Portfolio tracker (localStorage)
```

---

## Running Locally

**Backend** (port 8000):
```bash
cd backend
..\venv\Scripts\python -m uvicorn main:app --reload --port 8000
```

**Frontend** (port 3000):
```bash
cd frontend
npm run dev
```

---

## API Endpoints

All routes are prefixed with `/api/data`.

### `POST /api/data/screen`

Batch evaluates a list of entities and returns value metrics with pagination.

**Request body:**
```json
{
  "entities": [
    { "id": "energy", "type": "sector" },
    { "id": "AAPL",   "type": "ticker" },
    { "id": "dow30",  "type": "index" }
  ],
  "region": "us",   // "us" | "hk" | "all"
  "page": 1,
  "limit": 50
}
```

**Entity types:**
- `ticker` — individual stock symbol (e.g. `AAPL`, `0700.HK`)
- `sector` — GICS sector name (see [Supported Sectors](#supported-sectors))
- `index` — hardcoded index preset (see [Supported Indices](#supported-indices))

**Response:**
```json
{
  "results": [
    {
      "ticker": "XOM",
      "company_name": "Exxon Mobil",
      "price": 112.50,
      "pe": 14.2,
      "pb": 1.8,
      "peg": 1.1,
      "fcf": 14500000000,
      "intrinsic_value": 145.30,
      "graham_number": 98.20,
      "margin_of_safety": 22.5
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 183 }
}
```

> **Note:** Sector expansion paginates the Yahoo Finance screener API in batches of 250 (the per-call max) to collect **all** matching tickers before slicing for the requested page.

---

### `GET /api/data/stock/{ticker}`

Full deep-dive for a single ticker. Combines Yahoo Finance market data with SEC EDGAR fundamentals.

- US stocks: returns both Yahoo data + SEC company facts
- HK stocks (e.g. `0700.HK`): returns Yahoo data only (no SEC)

**Response includes:**
- `market_data` — price, P/E, P/B, PEG, FCF, market cap, currency
- `value_metrics` — DCF intrinsic value, Graham Number, margin of safety (DCF & Graham)
- `has_sec_data` — boolean

---

### `GET /api/data/search?q=<query>&region=<region>`

Autocomplete search combining internal presets + Yahoo Finance equities.

- Returns up to 100 results
- Supports tickers, sectors, and index names
- Filters by region: `"us"` (no dots), `"hk"` (`.HK` suffix), `"all"` (US + HK)

---

## Value Models

### DCF (Discounted Cash Flow)
Implemented in `calculators.py::calculate_dcf`.

Assumes:
- **Growth rate:** 5%
- **Discount rate:** 10%
- **Terminal multiple:** 10×
- **Projection period:** 5 years

Formula: Sum of PV of projected FCFs + PV of terminal value, divided by shares outstanding.

### Graham Number
Implemented in `calculators.py::calculate_graham_number`.

```
Graham Number = √(22.5 × EPS × Book Value Per Share)
```

### Piotroski F-Score
Implemented in `models/piotroski.py`. Scores 0–9 across three pillars:

| Pillar | Criteria |
|---|---|
| **Profitability** | Positive net income, ROA > 0, positive OCF, OCF > net income |
| **Leverage / Liquidity** | Lower LT debt YoY, higher current ratio YoY, no new shares issued |
| **Efficiency** | Higher gross margin YoY, higher asset turnover YoY |

> Note: Piotroski score is calculated but not yet surfaced in the frontend UI.

---

## Supported Sectors

| ID | Label |
|---|---|
| `technology` | Technology |
| `healthcare` | Healthcare |
| `financial-services` | Financial Services |
| `energy` | Energy |
| `industrials` | Industrials |
| `consumer-cyclical` | Consumer Cyclical |
| `consumer-defensive` | Consumer Defensive |
| `utilities` | Utilities |
| `real-estate` | Real Estate |
| `communication-services` | Communication Services |
| `basic-materials` | Basic Materials |

## Supported Indices

| ID | Contents |
|---|---|
| `dow30` | Dow Jones 30 components |
| `nasdaq10` | Top 10 Nasdaq tech stocks |
| `hk_tech` | Hong Kong tech stocks (HKEX) |
| `hk_finance` | Hong Kong finance stocks (HKEX) |

---

## Frontend Pages

| Route | Description |
|---|---|
| `/` | Dashboard — hero section + feature highlights |
| `/screener` | Sector/ticker screener with paginated results table |
| `/analysis` | Ticker search landing page |
| `/analysis/[ticker]` | Deep-dive analysis for a specific stock |
| `/portfolio` | Portfolio tracker — tickers saved to `localStorage`, shows price + margin of safety cards |

---

## Key Design Decisions

- **No database** — stateless backend; portfolio is stored in browser `localStorage`
- **Pagination** — sector expansion fetches all tickers from Yahoo (batched at 250/call), then paginates the full sorted list server-side (50/page default)
- **Region filtering** — applied at both search and screener level to keep US and HK stocks separated or combined as needed
- **HK stock support** — detected by `.HK` ticker suffix; SEC data is skipped for HK stocks
