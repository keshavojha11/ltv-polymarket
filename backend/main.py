"""
Polymarket LTV Risk Simulator — FastAPI Backend

Provides two endpoints:
1. GET  /api/markets  — Fetch top 50 active Polymarket markets, run LTV simulation
2. POST /api/simulate — Re-run LTV with custom parameter overrides

All Polymarket API calls are proxied through this backend to avoid CORS issues.
Market data is cached for 60 seconds to reduce API pressure.

Run with: uvicorn main:app --reload --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    MarketsResponse,
    SimulateRequest,
    SimulationConfig,
    ErrorResponse,
)
from ltv_engine import process_markets
from polymarket_client import fetch_enriched_markets, clear_cache

# ─── Logging ────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


# ─── Lifespan ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    logger.info("🚀 Polymarket LTV Risk Simulator starting up...")
    yield
    logger.info("👋 Shutting down...")


# ─── App ────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Polymarket LTV Risk Simulator",
    description=(
        "Simulates Revalon's two-bucket LTV model on live Polymarket positions. "
        "Fetches real-time market data, computes effective LTV, and flags risks."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for this demo project
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Simple health check for deployment probes."""
    return {"status": "ok", "service": "polymarket-ltv-simulator"}


@app.get(
    "/api/markets",
    response_model=MarketsResponse,
    responses={500: {"model": ErrorResponse}},
    summary="Fetch markets with default LTV simulation",
    description=(
        "Fetches top 50 active Polymarket markets sorted by 24h volume, "
        "runs the LTV simulation with default parameters, and returns "
        "enriched market data with risk flags."
    ),
)
async def get_markets():
    """
    Main endpoint: Fetch live markets → run LTV model → return results.
    
    Uses cached data if available (60s TTL). The LTV simulation uses
    default parameters (Bucket A: 0.80, Bucket B: 0.70).
    """
    try:
        # Fetch market data (cached or fresh)
        raw_markets = await fetch_enriched_markets()
        
        if not raw_markets:
            raise HTTPException(
                status_code=502,
                detail="No markets returned from Polymarket API"
            )
        
        # Run LTV simulation with default config
        config = SimulationConfig()
        markets, summary = process_markets(raw_markets, config)
        
        # Sort by volume (highest first)
        markets.sort(key=lambda m: m.volume_24h, reverse=True)
        
        return MarketsResponse(
            markets=markets,
            summary=summary,
            config_used=config,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching markets: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch and process markets: {str(e)}"
        )


@app.post(
    "/api/simulate",
    response_model=MarketsResponse,
    responses={500: {"model": ErrorResponse}},
    summary="Re-simulate LTV with custom parameters",
    description=(
        "Re-runs the LTV simulation on cached market data with custom "
        "parameter overrides. Used by the Parameter Tuner in the frontend."
    ),
)
async def simulate(request: SimulateRequest):
    """
    Re-run LTV simulation with custom parameters.
    
    Uses cached market data to avoid re-fetching from Polymarket.
    If no cached data exists, fetches fresh data first.
    """
    try:
        # Use cached data or fetch fresh
        raw_markets = await fetch_enriched_markets()
        
        if not raw_markets:
            raise HTTPException(
                status_code=502,
                detail="No markets available for simulation"
            )
        
        # Run LTV with custom config
        markets, summary = process_markets(raw_markets, request.config)
        
        # Sort by volume
        markets.sort(key=lambda m: m.volume_24h, reverse=True)
        
        return MarketsResponse(
            markets=markets,
            summary=summary,
            config_used=request.config,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in simulation: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Simulation failed: {str(e)}"
        )


@app.post("/api/refresh")
async def force_refresh():
    """Force clear cache and re-fetch from Polymarket."""
    clear_cache()
    return {"status": "cache_cleared"}
