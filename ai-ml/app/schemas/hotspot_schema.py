"""Pydantic schemas for the hotspot prediction endpoint."""

from __future__ import annotations

from typing import Dict, Optional

from pydantic import BaseModel, Field


class HotspotRequest(BaseModel):
    """Input schema for POST /predict-hotspot."""

    city: str = Field("Unknown", description="City name")
    state: str = Field("Unknown", description="State name")
    latitude: float = Field(20.0, ge=-90, le=90, description="Latitude of the location")
    longitude: float = Field(77.0, ge=-180, le=180, description="Longitude of the location")
    hour: int = Field(12, ge=0, le=23, description="Hour of day (0-23)")
    day_of_week: int = Field(0, ge=0, le=6, description="Day of week (0=Monday)")
    month: int = Field(6, ge=1, le=12, description="Month (1-12)")
    weather: str = Field("clear", description="Weather (clear/foggy/rainy/stormy)")
    road_type: str = Field("urban", description="Road type (highway/urban/rural)")
    visibility: str = Field("high", description="Visibility (high/medium/low)")
    traffic_density: str = Field("low", description="Traffic density (low/medium/high)")
    traffic_signal: int = Field(0, ge=0, le=1, description="Traffic signal present (0/1)")
    lanes: int = Field(2, ge=1, description="Number of lanes")
    temperature: float = Field(25.0, description="Temperature in Celsius")
    vehicles_involved: int = Field(1, ge=1, description="Vehicles involved in incident")
    casualties: int = Field(0, ge=0, description="Number of casualties")
    is_peak_hour: int = Field(0, ge=0, le=1, description="Peak hour flag (0/1)")
    festival: str = Field("None", description="Active festival/event (None or festival name)")
    cause: str = Field("weather", description="Primary cause of incident")

    model_config = {"str_strip_whitespace": True}


class HotspotResponse(BaseModel):
    """Output schema for POST /predict-hotspot."""

    risk_score: float = Field(..., ge=0.0, le=1.0, description="Hotspot risk score (0=safe, 1=critical)")
    risk_category: str = Field(..., description="Risk category label")
    metadata: Dict = Field(default_factory=dict)
