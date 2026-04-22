# Polymarket LTV Risk Simulator
<!-- Deployment Status Verified -->

> **[Live Demo](https://ltv-polymarket.vercel.app)** · **[Backend API](https://ltv-polymarket-production.up.railway.app/health)**

A high-fidelity, full-stack dashboard designed to simulate **Revalon's two-bucket LTV (Loan-to-Value) model** on real-time Polymarket prediction market data. This tool allows risk managers to visualize and tune leverage parameters for prediction-market-backed loans.

---

## 🚀 Key Features

- **Real-Time Data**: Proxies Polymarket Gamma & CLOB APIs for live market discovery and order book pricing.
- **Dynamic Simulation**: Interactive parameter tuner (LTV buckets, liquidation thresholds) with debounced real-time updates.
- **Risk Visualization**: High-fidelity scatter plot (Heatmap), bucket distribution analytics, and color-coded risk flags.
- **Robust Engineering**: Async FastAPI backend with 60s cache TTL and automatic mock-data fallback for connectivity issues.

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Frontend   │────▶│  FastAPI Backend  │────▶│  Polymarket APIs    │
│  React/Vite  │◀────│   LTV Engine      │◀────│  Gamma + CLOB       │
│  Tailwind v4 │     │   Async Engine    │     │  (no auth required) │
│  Recharts    │     └──────────────────┘     └─────────────────────┘
└─────────────┘
```

## 🧠 The LTV Model

The core logic implements a two-bucket model to differentiate between established, near-term markets and high-uncertainty positions.

### 1. Bucket Assignment
- **Bucket A** (High Confidence): `Price > 0.65` AND `Days to Resolution < 30`.
- **Bucket B** (Standard): All other qualifying markets.

### 2. Multiplier Logic
```python
effective_ltv = base_ltv × time_decay(days) × confidence_multiplier(price)
```
- **Time Decay**: Step function reducing leverage as resolution nears (e.g., LTV drops to 40% when ≤ 3 days remain).
- **Confidence Multiplier**: Rewards conviction (prices far from 0.50) using the formula: `0.5 + (|price - 0.50| * 0.8)`.

## 🧪 Technical Rigor

Safety and accuracy are non-negotiable for a risk tool.
- **Unit Testing**: Comprehensive test suite for the LTV engine covering edge cases in decay and multipliers. ([tests/test_ltv_engine.py](backend/tests/test_ltv_engine.py))
- **Pydantic Validation**: Strict type-safety and validation for all API request/response models.
- **Production Config**: Gunicorn with Uvicorn workers for the backend; Vercel SPA routing for the frontend.

## 🛠️ Tech Stack

- **Backend**: Python 3.9+, FastAPI, Httpx, Pandas, Pydantic, Gunicorn, Pytest.
- **Frontend**: React 18, Vite 6, Tailwind CSS v4, Recharts, Lucide Icons.
- **Deployment**: Railway (Backend), Vercel (Frontend).

---

## ⚡ Quick Start (Local)

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

The frontend proxies `/api/*` to `localhost:8000` automatically.

---
Built by [keshavojha11](https://github.com/keshavojha11).
