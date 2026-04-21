# Polymarket LTV Risk Simulator

A full-stack dashboard that simulates **Revalon's two-bucket LTV (Loan-to-Value) model** on real Polymarket prediction market positions. Built as an internal demo for Revalon's Q2 2026 launch.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Frontend   │────▶│  FastAPI Backend  │────▶│  Polymarket APIs    │
│  React/Vite  │◀────│   LTV Engine      │◀────│  Gamma + CLOB       │
│  Tailwind    │     │   Cache (60s)     │     │  (no auth required) │
│  Recharts    │     └──────────────────┘     └─────────────────────┘
└─────────────┘
```

- **Backend**: Python FastAPI (async httpx, Pydantic models)
- **Frontend**: React 18 + Tailwind CSS v4 + Recharts
- **APIs**: Polymarket Gamma (market discovery) + CLOB (live pricing)

## LTV Model

### Bucket Assignment
- **Bucket A** (high-confidence): `price > 0.65 AND days_to_resolution < 30`
- **Bucket B** (standard): everything else

### Effective LTV Calculation
```
effective_ltv = base_ltv × time_decay(days) × confidence_multiplier(price)
```

- **Time Decay**: `>30d: 1.0 | >7d: 0.85 | >3d: 0.65 | ≤3d: 0.40`
- **Confidence Multiplier**: `0.5 + (|price − 0.50| × 0.8)`
- **Borrow Capacity**: `effective_ltv × $100`

### Risk Flags
- **Liquidation Risk**: extreme price (>0.90 or <0.10) AND near expiry (<7 days)
- **Mispriced**: bucket assignment anomaly

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The frontend proxies `/api/*` requests to `http://localhost:8000` automatically.

Open **http://localhost:5173** in your browser.

## Dashboard Views

1. **Market Table** — Sortable/filterable table with color-coded buckets and risk flags
2. **Risk Heatmap** — Scatter plot (price × days) with LTV-colored dots and bucket boundaries
3. **Bucket Distribution** — Summary stat cards, bucket bar chart, flag pie chart, LTV histogram
4. **Parameter Tuner** — 5 interactive sliders with real-time simulation updates

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/markets` | Fetch top 50 markets with default LTV simulation |
| `POST` | `/api/simulate` | Re-run LTV with custom parameters |
| `POST` | `/api/refresh` | Force clear cache and re-fetch |
| `GET` | `/health` | Health check |

## Deployment

### Backend (Railway/Render)
```bash
cd backend
# Procfile: web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Frontend (Vercel)
```bash
cd frontend
# Set VITE_API_URL=https://your-backend.railway.app
npm run build
```

## Tech Stack
- FastAPI 0.115 · Uvicorn · httpx · Pydantic 2
- React 18 · Vite 6 · Tailwind CSS v4 · Recharts
- Polymarket Gamma API + CLOB API (no auth)
