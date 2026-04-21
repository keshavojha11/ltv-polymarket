"""
Pydantic models for the Polymarket LTV Risk Simulator.

Defines request/response schemas for the API endpoints and
the core data structures used throughout the simulation engine.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ─── Simulation Configuration ───────────────────────────────────────────────

class SimulationConfig(BaseModel):
    """
    Tunable parameters for the LTV simulation.
    
    These map directly to the Parameter Tuner sliders on the frontend.
    All values have sensible defaults matching Revalon's base model.
    """
    ltv_bucket_a: float = Field(
        default=0.80,
        ge=0.0, le=1.0,
        description="Base LTV for Bucket A (high-confidence, near-term markets)"
    )
    ltv_bucket_b: float = Field(
        default=0.70,
        ge=0.0, le=1.0,
        description="Base LTV for Bucket B (everything else)"
    )
    liquidation_threshold_high: float = Field(
        default=0.90,
        ge=0.5, le=1.0,
        description="Upper price threshold triggering liquidation risk flag"
    )
    liquidation_threshold_low: float = Field(
        default=0.10,
        ge=0.0, le=0.5,
        description="Lower price threshold triggering liquidation risk flag"
    )
    liquidation_window_days: int = Field(
        default=7,
        ge=1, le=30,
        description="Days-to-resolution threshold for liquidation risk flag"
    )


# ─── Market Result ──────────────────────────────────────────────────────────

class MarketResult(BaseModel):
    """
    A single market enriched with LTV simulation results.
    
    Combines raw Polymarket data with computed LTV metrics:
    - Bucket assignment (A or B) based on price + time
    - Effective LTV after applying time decay and confidence multiplier
    - Borrow capacity per $100 of collateral
    - Risk flags (liquidation risk, mispriced)
    """
    condition_id: str = Field(description="Polymarket condition ID (unique market identifier)")
    question: str = Field(description="Market question text")
    yes_price: float = Field(ge=0.0, le=1.0, description="Current YES token price (0-1)")
    days_to_resolution: int = Field(ge=0, description="Days until market end date")
    volume_24h: float = Field(ge=0.0, description="24-hour trading volume in USD")
    bucket: str = Field(description="Assigned LTV bucket: 'A' or 'B'")
    base_ltv: float = Field(ge=0.0, le=1.0, description="Base LTV before adjustments")
    effective_ltv: float = Field(ge=0.0, le=1.0, description="LTV after time decay × confidence multiplier")
    borrow_capacity_per_100: float = Field(
        ge=0.0,
        description="Borrow capacity per $100 of collateral (effective_ltv × 100)"
    )
    liquidation_risk: bool = Field(description="True if extreme price + near expiry")
    mispriced: bool = Field(description="True if bucket assignment differs from expected")
    # Optional enrichment fields
    end_date: Optional[str] = Field(default=None, description="ISO 8601 end date string")
    slug: Optional[str] = Field(default=None, description="Market URL slug")


# ─── Summary Statistics ─────────────────────────────────────────────────────

class Summary(BaseModel):
    """
    Aggregate statistics across all processed markets.
    Displayed in the Bucket Distribution view and status bar.
    """
    total_markets: int = Field(description="Total markets successfully processed")
    bucket_a_count: int = Field(description="Markets assigned to Bucket A")
    bucket_b_count: int = Field(description="Markets assigned to Bucket B")
    flagged_liquidation: int = Field(description="Markets with liquidation risk flag")
    flagged_mispriced: int = Field(description="Markets with mispriced flag")
    avg_effective_ltv: float = Field(description="Average effective LTV across all markets")
    total_volume_24h: float = Field(description="Sum of 24h volume across all markets")
    fetched_at: str = Field(description="ISO 8601 timestamp of when data was fetched")


# ─── API Responses ──────────────────────────────────────────────────────────

class MarketsResponse(BaseModel):
    """Response wrapper for both GET /api/markets and POST /api/simulate."""
    markets: List[MarketResult]
    summary: Summary
    config_used: SimulationConfig = Field(
        description="The simulation config that was used (for frontend display)"
    )


class SimulateRequest(BaseModel):
    """Request body for POST /api/simulate."""
    config: SimulationConfig


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    detail: Optional[str] = None
