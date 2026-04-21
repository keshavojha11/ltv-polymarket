import pytest
from ltv_engine import (
    time_decay,
    confidence_multiplier,
    assign_bucket,
    compute_effective_ltv,
    process_markets
)
from models import SimulationConfig, MarketResult

# ─── Component Tests ────────────────────────────────────────────────────────

def test_time_decay():
    """Verify time decay buckets match Revalon PRD."""
    assert time_decay(45) == 1.0    # > 30 days
    assert time_decay(15) == 0.85   # 8-30 days
    assert time_decay(5) == 0.65    # 4-7 days
    assert time_decay(2) == 0.40    # <= 3 days

def test_confidence_multiplier():
    """Verify conviction bonus — higher confidence = higher LTV."""
    # 0.50 (No conviction) -> 0.5 + 0 = 0.5
    assert confidence_multiplier(0.50) == 0.5
    
    # 0.90 (High conviction) -> 0.5 + (0.4 * 0.8) = 0.82
    assert pytest.approx(confidence_multiplier(0.90)) == 0.82
    
    # 0.10 (High conviction against) -> 0.5 + (0.4 * 0.8) = 0.82
    assert pytest.approx(confidence_multiplier(0.10)) == 0.82

def test_bucket_assignment():
    """Verify Bucket A vs B logic."""
    # High price, near term -> Bucket A
    assert assign_bucket(0.85, 10) == "A"
    
    # Low price -> Bucket B
    assert assign_bucket(0.40, 10) == "B"
    
    # Long term -> Bucket B
    assert assign_bucket(0.85, 45) == "B"

def test_effective_ltv_flow():
    """End-to-end LTV check for a specific scenario."""
    base_ltv = 0.80
    price = 0.90  # Conf mult = 0.82
    days = 5      # Time decay = 0.65
    config = SimulationConfig(ltv_bucket_a=0.80)
    
    expected = base_ltv * 0.65 * 0.82
    result = compute_effective_ltv(price, days, config)["effective_ltv"]
    
    assert pytest.approx(result) == expected


# ─── Batch Processing Tests ────────────────────────────────────────────────

def test_process_markets():
    """Verify the engine processes raw data into correct Pydantic models."""
    raw_data = [
        {
            "condition_id": "0x123",
            "question": "Test Market A",
            "yes_price": 0.95,  # > 0.90 threshold
            "days_to_resolution": 5,
            "volume_24h": 1000000
        },
        {
            "condition_id": "0x456",
            "question": "Test Market B",
            "yes_price": 0.40,
            "days_to_resolution": 45,
            "volume_24h": 500000
        }
    ]
    
    config = SimulationConfig(ltv_bucket_a=0.80, ltv_bucket_b=0.70)
    markets, summary = process_markets(raw_data, config)
    
    assert len(markets) == 2
    assert summary.total_markets == 2
    
    # Check Market A (Bucket A)
    market_a = next(m for m in markets if m.condition_id == "0x123")
    assert market_a.bucket == "A"
    assert market_a.liquidation_risk is True  # High price + low days
    
    # Check Market B (Bucket B)
    market_b = next(m for m in markets if m.condition_id == "0x456")
    assert market_b.bucket == "B"
    assert market_b.liquidation_risk is False
