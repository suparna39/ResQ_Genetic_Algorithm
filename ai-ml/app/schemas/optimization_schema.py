"""Pydantic schemas for the ambulance optimisation endpoint."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class AmbulanceInfo(BaseModel):
    """Schema for a single ambulance in the fleet."""

    id: str = Field(..., description="Unique ambulance identifier")
    latitude: float = Field(..., ge=-90, le=90, description="Current latitude")
    longitude: float = Field(..., ge=-180, le=180, description="Current longitude")
    status: str = Field("available", description="Status: available | busy | offline")
    capability_level: int = Field(2, ge=1, le=4,
                                  description="Capability level (1=basic BLS, 4=advanced MICU)")
    vehicle_type: Optional[str] = Field(None, description="Vehicle type label")
    crew_size: Optional[int] = Field(None, description="Number of crew members")

    model_config = {"str_strip_whitespace": True}


class OptimizationRequest(BaseModel):
    """Input schema for POST /optimize-ambulance."""

    # Patient / emergency context
    patient_lat: float = Field(..., ge=-90, le=90, description="Patient latitude")
    patient_lon: float = Field(..., ge=-180, le=180, description="Patient longitude")
    emergency_type: str = Field("accident", description="Emergency type")
    priority_class: str = Field("High", description="Priority class (Low/Medium/High/Critical)")
    hotspot_risk: float = Field(0.5, ge=0.0, le=1.0, description="Hotspot risk score from Model 2")
    congestion_multiplier: float = Field(1.0, ge=1.0, description="Traffic multiplier from Model 3")

    # Fleet
    ambulances: List[AmbulanceInfo] = Field(..., min_length=1,
                                            description="List of available ambulances")

    # GA hyper-parameters (optional overrides)
    population_size: Optional[int] = Field(None, ge=10, le=500)
    max_generations: Optional[int] = Field(None, ge=10, le=1000)

    @field_validator("priority_class")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        valid = {"Low", "Medium", "High", "Critical"}
        if v not in valid:
            raise ValueError(f"priority_class must be one of {valid}")
        return v

    model_config = {"str_strip_whitespace": True}


class BackupSuggestion(BaseModel):
    ambulance_id: str
    fitness: float
    eta_minutes: float


class GAMetadata(BaseModel):
    generations_run: int
    convergence_generation: int
    population_size: int
    max_generations: int
    final_best_fitness: float


class OptimizationResponse(BaseModel):
    """Output schema for POST /optimize-ambulance."""

    best_ambulance_id: Optional[str] = Field(None, description="ID of the selected ambulance")
    best_ambulance: Optional[Dict[str, Any]] = Field(None, description="Full ambulance details")
    estimated_eta_minutes: Optional[float] = Field(None, description="Estimated ETA in minutes")
    fitness_score: Optional[float] = Field(None, description="GA fitness score for the assignment")
    distance_km: Optional[float] = Field(None, description="Straight-line distance in km")
    backup_suggestions: List[BackupSuggestion] = Field(default_factory=list,
                                                       description="Top-2 alternative ambulances")
    reason_for_assignment: str = Field("", description="Human-readable reason for the assignment")
    ga_metadata: Optional[Dict[str, Any]] = Field(None, description="GA run statistics")
