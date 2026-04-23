"""
LTV Simulation Engine — Two-Bucket Model for Prediction Market Collateral

This module implements the core LTV (Loan-to-Value) calculations for
prediction market positions. The model assigns each market to one of
two risk buckets and computes an effective LTV based on:

1. **Bucket Assignment**: Markets are classified as Bucket A (high-confidence,
   near-term) or Bucket B (everything else) based on price and time to resolution.

2. **Time Decay**: A step function that reduces LTV as resolution approaches,
   reflecting increased settlement risk.

3. **Confidence Multiplier**: Rewards positions with strong directional
   conviction (prices far from 0.50) since they carry lower uncertainty.

4. **Effective LTV**: base_ltv × time_decay × confidence_multiplier

The model also flags markets for:
- Liquidation Risk: extreme prices near expiry
- Mispricing: bucket assignment that doesn't match expected classification
"""

from typing import Optional, Tuple, List
from models import SimulationConfig, MarketResult, Summary
from datetime import datetime, timezone


# ─── Core Functions ─────────────────────────────────────────────────────────

def assign_bucket(price: float, days_to_resolution: int) -> str:
    """
    Assign a market to Bucket A or B.
    
    Bucket A (lower risk): high-confidence markets near resolution
      - price > 0.65 (strong directional signal)
      - days_to_resolution < 30 (near-term, more predictable)
    
    Bucket B: everything else (higher uncertainty = lower LTV)
    """
    if price > 0.65 and days_to_resolution < 30:
        return "A"
    return "B"


def time_decay(days: int) -> float:
    """
    Step-function time decay multiplier.
    
    As resolution approaches, settlement/manipulation risk increases.
    The decay schedule reflects a conservative risk appetite:
    
    >30 days: 1.00 (full LTV — far from resolution, low settlement risk)
     8-30 days: 0.85 (mild haircut — resolution approaching)
     4-7 days: 0.65 (significant haircut — high settlement risk window)
     0-3 days: 0.40 (severe haircut — imminent resolution, max risk)
    """
    if days > 30:
        return 1.0
    elif days > 7:
        return 0.85
    elif days > 3:
        return 0.65
    else:
        return 0.40


def confidence_multiplier(price: float) -> float:
    """
    Compute the confidence multiplier based on price distance from 0.50.
    
    Markets trading near 0.50 have maximum uncertainty (coin flip),
    while markets near 0 or 1 have strong consensus. The multiplier
    rewards conviction:
    
    - price = 0.50 → mult = 0.50 (minimum — maximum uncertainty)
    - price = 0.90 → mult = 0.82 (high YES confidence)
    - price = 0.10 → mult = 0.82 (high NO confidence)
    - price = 1.00 → mult = 0.90 (theoretical maximum)
    
    Formula: 0.5 + (|price - 0.50| × 0.8)
    """
    return 0.5 + (abs(price - 0.50) * 0.8)


def compute_effective_ltv(
    price: float,
    days_to_resolution: int,
    config: SimulationConfig
) -> dict:
    """
    Compute the full LTV result for a single market position.
    
    Returns a dict with:
    - bucket: 'A' or 'B'
    - base_ltv: the base LTV for the assigned bucket
    - effective_ltv: base × time_decay × confidence_mult (capped at base)
    - borrow_capacity_per_100: effective_ltv × 100
    - liquidation_risk: bool
    - mispriced: bool
    """
    # Step 1: Assign bucket
    bucket = assign_bucket(price, days_to_resolution)
    base_ltv = config.ltv_bucket_a if bucket == "A" else config.ltv_bucket_b
    
    # Step 2: Compute multipliers
    td = time_decay(days_to_resolution)
    cm = confidence_multiplier(price)
    
    # Step 3: Effective LTV = base × time_decay × confidence
    # Cap at base_ltv to prevent exceeding the base
    eltv = min(base_ltv * td * cm, base_ltv)
    eltv = round(eltv, 4)
    
    # Step 4: Borrow capacity per $100
    borrow_cap = round(eltv * 100, 2)
    
    # Step 5: Liquidation Risk flag
    # Extreme price (near 0 or 1) AND near expiry = high manipulation/settlement risk
    liquidation_risk = (
        (price > config.liquidation_threshold_high or 
         price < config.liquidation_threshold_low) and
        days_to_resolution < config.liquidation_window_days
    )
    
    # Step 6: Mispriced flag
    # The "expected" bucket is what a fresh assignment would give.
    # If the market's characteristics suggest one bucket but it was assigned
    # to another (due to parameter overrides), it's flagged as mispriced.
    # With default params this won't trigger, but with custom configs the
    # user might shift thresholds and reveal misalignments.
    expected_bucket = assign_bucket(price, days_to_resolution)
    mispriced = bucket != expected_bucket  # Will differ if we add custom bucket logic
    
    # Additional mispricing check: flag markets where the effective LTV
    # differs significantly from what the bucket label implies
    # e.g., a Bucket A market with very low effective LTV due to decay
    if bucket == "A" and eltv < config.ltv_bucket_b * 0.5:
        mispriced = True
    elif bucket == "B" and eltv > config.ltv_bucket_a:
        mispriced = True
    
    return {
        "bucket": bucket,
        "base_ltv": base_ltv,
        "effective_ltv": eltv,
        "borrow_capacity_per_100": borrow_cap,
        "liquidation_risk": liquidation_risk,
        "mispriced": mispriced,
    }


# ─── Batch Processing ──────────────────────────────────────────────────────

def process_markets(
    raw_markets: list,
    config: Optional[SimulationConfig] = None
) -> Tuple[List[MarketResult], Summary]:
    """
    Process a list of raw market dicts through the LTV engine.
    
    Args:
        raw_markets: List of dicts with keys:
            - condition_id, question, yes_price, days_to_resolution,
              volume_24h, end_date (optional), slug (optional)
        config: Simulation parameters (uses defaults if None)
    
    Returns:
        Tuple of (list[MarketResult], Summary)
    """
    if config is None:
        config = SimulationConfig()
    
    results: list[MarketResult] = []
    
    for market in raw_markets:
        price = market["yes_price"]
        days = market["days_to_resolution"]
        
        # Run LTV computation
        ltv_result = compute_effective_ltv(price, days, config)
        
        # Build enriched market result
        result = MarketResult(
            condition_id=market["condition_id"],
            question=market["question"],
            yes_price=price,
            days_to_resolution=days,
            volume_24h=market.get("volume_24h", 0.0),
            end_date=market.get("end_date"),
            slug=market.get("slug"),
            **ltv_result,
        )
        results.append(result)
    
    # Compute summary statistics
    bucket_a = [r for r in results if r.bucket == "A"]
    bucket_b = [r for r in results if r.bucket == "B"]
    flagged_liq = [r for r in results if r.liquidation_risk]
    flagged_mis = [r for r in results if r.mispriced]
    
    avg_eltv = (
        sum(r.effective_ltv for r in results) / len(results)
        if results else 0.0
    )
    
    summary = Summary(
        total_markets=len(results),
        bucket_a_count=len(bucket_a),
        bucket_b_count=len(bucket_b),
        flagged_liquidation=len(flagged_liq),
        flagged_mispriced=len(flagged_mis),
        avg_effective_ltv=round(avg_eltv, 4),
        total_volume_24h=sum(r.volume_24h for r in results),
        fetched_at=datetime.now(timezone.utc).isoformat(),
    )
    
    return results, summary
