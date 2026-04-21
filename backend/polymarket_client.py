"""
Polymarket API Client — Async market data fetcher.

Uses two Polymarket APIs:
1. Gamma API (gamma-api.polymarket.com) — Market discovery, metadata, and filtering.
   Provides: question, endDate, volumeNum, clobTokenIds, outcomePrices, active/closed status.
   
2. CLOB API (clob.polymarket.com) — Live pricing and order book data.
   Used as fallback for price data when Gamma's outcomePrices is stale/missing.

Caching Strategy:
- In-memory cache with 60s TTL for raw market data.
- Reduces API calls on rapid frontend refreshes and parameter tuning.

Rate Limiting:
- Polymarket allows ~100 req/min (no auth required for reads).
- We use asyncio.Semaphore(10) to limit concurrent CLOB price requests.
"""

import asyncio
import time
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Tuple, List, Any

import httpx

logger = logging.getLogger(__name__)

# ─── Configuration ──────────────────────────────────────────────────────────

GAMMA_API_BASE = "https://gamma-api.polymarket.com"
CLOB_API_BASE = "https://clob.polymarket.com"

# Concurrency limit for individual price lookups
MAX_CONCURRENT_PRICE_REQUESTS = 10

# Cache TTL in seconds
CACHE_TTL = 60

# Request timeout
REQUEST_TIMEOUT = 15.0


# ─── Cache ──────────────────────────────────────────────────────────────────

class SimpleCache:
    """Thread-safe in-memory cache with TTL."""
    
    def __init__(self, ttl: int = CACHE_TTL):
        self.ttl = ttl
        self._store: Dict[str, Tuple[float, Any]] = {}
    
    def get(self, key: str) -> Optional[any]:
        if key in self._store:
            timestamp, data = self._store[key]
            if time.time() - timestamp < self.ttl:
                return data
            del self._store[key]
        return None
    
    def set(self, key: str, data: any):
        self._store[key] = (time.time(), data)
    
    def clear(self):
        self._store.clear()


_cache = SimpleCache()


# ─── API Client ─────────────────────────────────────────────────────────────

async def fetch_markets_from_gamma(client: httpx.AsyncClient, limit: int = 50) -> list:
    """
    Fetch active markets from the Gamma API, sorted by 24h volume.
    
    Query params:
    - active=true, closed=false: only live markets
    - order=volume24hr, ascending=false: highest volume first
    - limit=50: top 50 markets
    
    Returns a list of raw market dicts from the Gamma API.
    """
    params = {
        "active": "true",
        "closed": "false",
        "order": "volume24hr",
        "ascending": "false",
        "limit": str(limit),
    }
    
    resp = await client.get(f"{GAMMA_API_BASE}/markets", params=params)
    resp.raise_for_status()
    
    markets = resp.json()
    
    # Gamma returns a list directly (not paginated for small limits)
    if isinstance(markets, dict) and "data" in markets:
        markets = markets["data"]
    
    return markets


async def fetch_midpoint_price(
    client: httpx.AsyncClient,
    token_id: str,
    semaphore: asyncio.Semaphore
) -> Optional[float]:
    """
    Fetch the midpoint price for a specific token from the CLOB API.
    
    Uses /midpoint endpoint which returns the midpoint between
    best bid and best ask — the most accurate current price.
    
    Falls back to /price if midpoint is unavailable.
    """
    async with semaphore:
        try:
            resp = await client.get(
                f"{CLOB_API_BASE}/midpoint",
                params={"token_id": token_id}
            )
            resp.raise_for_status()
            data = resp.json()
            
            # Response format: {"mid": "0.87"}
            if "mid" in data:
                return float(data["mid"])
            
            # Fallback: try /price endpoint
            resp = await client.get(
                f"{CLOB_API_BASE}/price",
                params={"token_id": token_id, "side": "buy"}
            )
            resp.raise_for_status()
            data = resp.json()
            if "price" in data:
                return float(data["price"])
                
        except Exception as e:
            logger.warning(f"Failed to fetch price for token {token_id}: {e}")
        
        return None


def _parse_yes_price(market: dict) -> Optional[float]:
    """
    Extract the YES token price from Gamma API market data.
    
    Gamma provides `outcomePrices` as a JSON string like '[\"0.87\",\"0.13\"]'.
    Index 0 = YES price, Index 1 = NO price.
    """
    outcome_prices = market.get("outcomePrices")
    if outcome_prices:
        try:
            if isinstance(outcome_prices, str):
                prices = json.loads(outcome_prices)
            else:
                prices = outcome_prices
            if prices and len(prices) > 0:
                return float(prices[0])
        except (json.JSONDecodeError, ValueError, IndexError):
            pass
    return None


def _parse_token_ids(market: dict) -> Optional[str]:
    """
    Extract the YES token ID from Gamma API market data.
    
    Gamma provides `clobTokenIds` as a JSON string like '[\"12345...\",\"67890...\"]'.
    Index 0 = YES token, Index 1 = NO token.
    """
    token_ids = market.get("clobTokenIds")
    if token_ids:
        try:
            if isinstance(token_ids, str):
                ids = json.loads(token_ids)
            else:
                ids = token_ids
            if ids and len(ids) > 0:
                return ids[0]
        except (json.JSONDecodeError, ValueError, IndexError):
            pass
    return None


def _compute_days_to_resolution(market: dict) -> int:
    """
    Compute days from now until the market's end date.
    
    Handles multiple date field names and formats from Gamma API.
    Returns 0 if the end date is in the past, or 999 if no date is found.
    """
    end_date_str = (
        market.get("endDate") or 
        market.get("end_date_iso") or 
        market.get("endDateIso")
    )
    
    if not end_date_str:
        return 999  # Unknown end date → treat as far-future (Bucket B)
    
    try:
        # Parse ISO 8601 format
        end_date_str = end_date_str.replace("Z", "+00:00")
        end_date = datetime.fromisoformat(end_date_str)
        
        # Ensure timezone-aware
        if end_date.tzinfo is None:
            end_date = end_date.replace(tzinfo=timezone.utc)
        
        now = datetime.now(timezone.utc)
        delta = end_date - now
        
        return max(0, delta.days)
    except (ValueError, TypeError):
        return 999


import random

def generate_mock_markets(count: int = 50) -> List[dict]:
    """Generate realistic mock Polymarket data for demo purposes."""
    questions = [
        "Will Bitcoin hit $100k in 2026?",
        "Will Fed cut rates in June?",
        "Will SpaceX land on Mars by Dec 2026?",
        "Will Apple release a fold phone by Q4?",
        "Will US GDP grow > 3% in 2026?",
        "Will oil price stay below $80/bbl?",
        "Will Gemini outperform GPT-5 on MMLU?",
        "Will there be a global plastic treaty by June?",
        "Will Nvidia hit $5T market cap?",
        "Will EU ban AI generated political ads?",
    ]
    
    mock_data = []
    for i in range(count):
        q = random.choice(questions) + f" (ID: {i+1})"
        price = random.uniform(0.05, 0.95)
        days = random.randint(1, 120)
        vol = random.uniform(50000, 2000000)
        
        mock_data.append({
            "condition_id": f"0xmock_{i}",
            "question": q,
            "yes_price": round(price, 4),
            "days_to_resolution": days,
            "volume_24h": round(vol, 2),
            "end_date": datetime.now(timezone.utc).isoformat(),
            "slug": f"mock-market-{i}"
        })
    return mock_data

async def fetch_enriched_markets(force_refresh: bool = False) -> list:
    """
    Main entry point: fetch and enrich markets with price data.
    Falls back to mock data if APIs are unreachable.
    """
    # Check cache
    if not force_refresh:
        cached = _cache.get("enriched_markets")
        if cached is not None:
            logger.info("Returning cached market data")
            return cached
    
    try:
        logger.info("Fetching fresh market data from Polymarket...")
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            # Step 1: Fetch markets from Gamma
            raw_markets = await fetch_markets_from_gamma(client)
            logger.info(f"Fetched {len(raw_markets)} markets from Gamma API")
            
            # Step 2: Process each market
            semaphore = asyncio.Semaphore(MAX_CONCURRENT_PRICE_REQUESTS)
            enriched = []
            
            # Collect markets that need CLOB price lookups
            needs_price_lookup = []  # type: List[Tuple[int, str]]
            
            for i, market in enumerate(raw_markets):
                condition_id = market.get("conditionId") or market.get("condition_id", "")
                question = market.get("question", "Unknown Market")
                volume_24h = float(market.get("volume24hr") or market.get("volumeNum") or 0)
                end_date = market.get("endDate") or market.get("end_date_iso", "")
                slug = market.get("slug", "")
                
                # Try to get price from Gamma first
                yes_price = _parse_yes_price(market)
                days = _compute_days_to_resolution(market)
                
                # Filter: skip if end_date is in the past
                if days == 0 and end_date:
                    continue
                
                entry = {
                    "condition_id": condition_id,
                    "question": question,
                    "yes_price": yes_price,
                    "days_to_resolution": days,
                    "volume_24h": volume_24h,
                    "end_date": end_date,
                    "slug": slug,
                }
                enriched.append(entry)
                
                # If no price from Gamma, queue for CLOB lookup
                if yes_price is None:
                    token_id = _parse_token_ids(market)
                    if token_id:
                        needs_price_lookup.append((len(enriched) - 1, token_id))
            
            # Step 3: Batch fetch missing prices from CLOB
            if needs_price_lookup:
                logger.info(f"Fetching {len(needs_price_lookup)} prices from CLOB API...")
                
                async def _fetch_and_assign(idx: int, token_id: str):
                    price = await fetch_midpoint_price(client, token_id, semaphore)
                    if price is not None:
                        enriched[idx]["yes_price"] = price
                
                tasks = [
                    _fetch_and_assign(idx, tid) 
                    for idx, tid in needs_price_lookup
                ]
                await asyncio.gather(*tasks, return_exceptions=True)
            
            # Step 4: Filter out markets with no price data
            result = [
                m for m in enriched 
                if m["yes_price"] is not None
            ]
            
            if not result:
                raise ValueError("No enriched markets found")

            logger.info(
                f"Successfully enriched {len(result)}/{len(raw_markets)} markets"
            )
            
            # Cache the result
            _cache.set("enriched_markets", result)
            return result

    except Exception as e:
        logger.warning(f"Polymarket API unreachable: {e}. Falling back to mock data.")
        mock_result = generate_mock_markets()
        _cache.set("enriched_markets", mock_result)
        return mock_result


def clear_cache():
    """Clear the market data cache (used on force refresh)."""
    _cache.clear()
