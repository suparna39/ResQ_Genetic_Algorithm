"""Pydantic schemas for the traffic estimation endpoint."""

from __future__ import annotations

from typing import Dict

from pydantic import BaseModel, Field


class TrafficRequest(BaseModel):
    """Input schema for POST /predict-traffic."""

    hour: int = Field(12, ge=0, le=23, description="Hour of day (0-23)")
    day_of_week: int = Field(0, ge=0, le=6, description="Day of week (0=Monday)")
    is_weekend: int = Field(0, ge=0, le=1, description="Weekend flag (0/1)")
    road_type: str = Field("urban", description="Road type category (city/urban)")
    monthly_avg_congestion: float = Field(33.0, ge=0, le=100,
                                          description="Historical monthly avg congestion (%)")

    model_config = {"str_strip_whitespace": True}


class TrafficResponse(BaseModel):
    """Output schema for POST /predict-traffic."""

    congestion_pct: float = Field(..., ge=0, le=100, description="Predicted congestion percentage")
    congestion_multiplier: float = Field(..., ge=1.0, description="Travel time multiplier (1.0 = no delay)")
    traffic_level: str = Field(..., description="Human-readable traffic level label")
    metadata: Dict = Field(default_factory=dict)
