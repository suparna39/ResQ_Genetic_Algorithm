"""
test_inference.py — Quick local inference smoke tests.

Run after training:
    python test_inference.py

Tests all three model inferences and the GA engine without starting the
full FastAPI server.
"""

from __future__ import annotations

import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.core.logging import setup_logging, get_logger
from app.services.model_loader import load_all_models
from app.services.priority_service import predict_priority
from app.services.hotspot_service import predict_hotspot
from app.services.traffic_service import predict_traffic
from app.services.ga_service import optimize_ambulance

setup_logging()
logger = get_logger("test_inference")


def test_priority():
    logger.info("── Testing priority prediction ──")
    result = predict_priority({
        "emergency_type": "accident",
        "weather": "rainy",
        "road_condition": "wet",
        "road_type": "national highway",
        "lighting": "dark",
        "traffic_control": "signals",
        "vehicle_type": "Two-Wheeler",
        "location_type": "Intersection",
        "hour": 21,
        "day_of_week": 4,
        "month": 7,
        "num_vehicles": 3,
        "num_casualties": 5,
        "num_fatalities": 2,
        "speed_limit": 80,
        "driver_age": 25,
        "driver_gender": "Male",
        "license_status": "valid",
        "alcohol_involvement": "Yes",
        "state": "Maharashtra",
        "city": "Mumbai",
    })
    logger.info("Priority result: %s", json.dumps(result, indent=2))
    assert "priority_class" in result
    logger.info("✅ Priority test PASSED")


def test_hotspot():
    logger.info("── Testing hotspot prediction ──")
    result = predict_hotspot({
        "city": "Delhi",
        "state": "Delhi",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "hour": 8,
        "day_of_week": 0,
        "month": 10,
        "weather": "foggy",
        "road_type": "urban",
        "visibility": "low",
        "traffic_density": "high",
        "traffic_signal": 1,
        "lanes": 4,
        "temperature": 22,
        "vehicles_involved": 3,
        "casualties": 2,
        "is_peak_hour": 1,
        "festival": "None",
        "cause": "overspeeding",
    })
    logger.info("Hotspot result: %s", json.dumps(result, indent=2))
    assert "risk_score" in result
    logger.info("✅ Hotspot test PASSED")


def test_traffic():
    logger.info("── Testing traffic prediction ──")
    result = predict_traffic({
        "hour": 18,
        "day_of_week": 1,  # Tuesday
        "is_weekend": 0,
        "road_type": "urban",
        "monthly_avg_congestion": 35.0,
    })
    logger.info("Traffic result: %s", json.dumps(result, indent=2))
    assert "congestion_pct" in result
    logger.info("✅ Traffic test PASSED")


def test_ga():
    logger.info("── Testing GA ambulance optimisation ──")
    ambulances = [
        {"id": "AMB-001", "latitude": 28.620, "longitude": 77.210, "status": "available", "capability_level": 4},
        {"id": "AMB-002", "latitude": 28.640, "longitude": 77.195, "status": "available", "capability_level": 2},
        {"id": "AMB-003", "latitude": 28.600, "longitude": 77.230, "status": "busy",      "capability_level": 3},
        {"id": "AMB-004", "latitude": 28.650, "longitude": 77.200, "status": "available", "capability_level": 1},
        {"id": "AMB-005", "latitude": 28.610, "longitude": 77.220, "status": "available", "capability_level": 3},
    ]
    result = optimize_ambulance(
        patient_lat=28.6139,
        patient_lon=77.2090,
        priority_class="Critical",
        hotspot_risk=0.85,
        congestion_multiplier=1.8,
        ambulances=ambulances,
        population_size=30,
        max_generations=50,
    )
    logger.info("GA result: %s", json.dumps(result, indent=2, default=str))
    assert result["best_ambulance_id"] is not None
    logger.info("✅ GA test PASSED — Selected: %s, ETA: %.1f min",
                result["best_ambulance_id"], result["estimated_eta_minutes"])


if __name__ == "__main__":
    logger.info("Loading model artifacts...")
    status = load_all_models()
    logger.info("Loaded: %s", status)

    failed = []
    for test_fn in [test_priority, test_hotspot, test_traffic, test_ga]:
        try:
            test_fn()
        except Exception as exc:
            logger.error("❌ %s FAILED: %s", test_fn.__name__, exc)
            failed.append(test_fn.__name__)

    if failed:
        logger.error("\nFailed tests: %s", failed)
        sys.exit(1)
    else:
        logger.info("\n🎉 All inference tests PASSED!")
