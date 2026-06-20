"""Pydantic schemas for the priority prediction endpoint."""

from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class PriorityRequest(BaseModel):
    """Input schema for POST /predict-priority."""

    emergency_type: str = Field("accident", description="Type of emergency (accident, medical, fire, etc.)")
    weather: str = Field("clear", description="Weather conditions (clear, foggy, rainy, stormy, hazy)")
    road_condition: str = Field("dry", description="Road surface condition")
    road_type: str = Field("urban road", description="Type of road")
    lighting: str = Field("daylight", description="Lighting conditions")
    traffic_control: str = Field("none", description="Traffic control presence")
    vehicle_type: str = Field("Car", description="Vehicle type involved")
    location_type: str = Field("Straight Road", description="Accident location type")
    hour: int = Field(12, ge=0, le=23, description="Hour of day (0-23)")
    day_of_week: int = Field(0, ge=0, le=6, description="Day of week (0=Monday)")
    month: int = Field(6, ge=1, le=12, description="Month (1-12)")
    num_vehicles: int = Field(1, ge=1, description="Number of vehicles involved")
    num_casualties: int = Field(0, ge=0, description="Number of casualties")
    num_fatalities: int = Field(0, ge=0, description="Number of fatalities")
    speed_limit: float = Field(50.0, ge=0, description="Speed limit in km/h")
    driver_age: int = Field(35, ge=16, le=90, description="Driver age")
    driver_gender: str = Field("Male", description="Driver gender")
    license_status: str = Field("valid", description="License status (valid/expired/none)")
    alcohol_involvement: str = Field("No", description="Alcohol involvement (Yes/No)")
    state: str = Field("Unknown", description="State name")
    city: str = Field("Unknown", description="City name")

    model_config = {"str_strip_whitespace": True}


class PriorityResponse(BaseModel):
    """Output schema for POST /predict-priority."""

    priority_class: str = Field(..., description="Predicted priority (Low/Medium/High/Critical)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence (0-1)")
    label_probabilities: Dict[str, float] = Field(..., description="Per-class probability scores")
    metadata: Dict = Field(default_factory=dict, description="Model metadata")
