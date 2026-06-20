"""
Central configuration for the AI Ambulance Allocation Service.

All settings are loaded from environment variables with safe defaults,
making the service configurable at runtime without code changes.
"""

import os
from pathlib import Path
from typing import List

# ── Project paths ──────────────────────────────────────────────────────────────
BASE_DIR: Path = Path(__file__).resolve().parents[2]
DATASETS_DIR: Path = BASE_DIR / "datasets"
ARTIFACTS_DIR: Path = BASE_DIR / "artifacts"
MODELS_DIR: Path = ARTIFACTS_DIR / "models"
ENCODERS_DIR: Path = ARTIFACTS_DIR / "encoders"
SCALERS_DIR: Path = ARTIFACTS_DIR / "scalers"
REPORTS_DIR: Path = ARTIFACTS_DIR / "reports"

# Ensure artifact directories exist
for _d in [MODELS_DIR, ENCODERS_DIR, SCALERS_DIR, REPORTS_DIR]:
    _d.mkdir(parents=True, exist_ok=True)

# ── Dataset paths ──────────────────────────────────────────────────────────────
PRIORITY_CSV: Path = DATASETS_DIR / "Emergency Priority Prediction (Model 1).csv"
HOTSPOT_CSV: Path = DATASETS_DIR / "Emergency Hotspot Prediction (Model 2).csv"
TRAFFIC_DATASET_DIR: Path = DATASETS_DIR / "new_delhi_traffic_dataset"

# ── Artifact file names ────────────────────────────────────────────────────────
PRIORITY_MODEL_FILE: str = "priority_model.joblib"
HOTSPOT_MODEL_FILE: str = "hotspot_model.joblib"
TRAFFIC_MODEL_FILE: str = "traffic_model.joblib"
PRIORITY_ENCODER_FILE: str = "priority_encoders.joblib"
HOTSPOT_ENCODER_FILE: str = "hotspot_encoders.joblib"
TRAFFIC_ENCODER_FILE: str = "traffic_encoders.joblib"
PRIORITY_SCALER_FILE: str = "priority_scaler.joblib"
HOTSPOT_SCALER_FILE: str = "hotspot_scaler.joblib"
TRAFFIC_SCALER_FILE: str = "traffic_scaler.joblib"

# ── Service settings ───────────────────────────────────────────────────────────
SERVICE_NAME: str = os.getenv("SERVICE_NAME", "AI Ambulance Allocation Service")
SERVICE_VERSION: str = os.getenv("SERVICE_VERSION", "1.0.0")
ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
PORT: int = int(os.getenv("PORT", "8000"))
HOST: str = os.getenv("HOST", "0.0.0.0")

# ── CORS ───────────────────────────────────────────────────────────────────────
CORS_ORIGINS: List[str] = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:8000,http://localhost:5173"
).split(",")

# ── ML training settings ───────────────────────────────────────────────────────
RANDOM_SEED: int = int(os.getenv("RANDOM_SEED", "42"))
TEST_SIZE: float = float(os.getenv("TEST_SIZE", "0.2"))
CV_FOLDS: int = int(os.getenv("CV_FOLDS", "5"))

# ── GA settings ───────────────────────────────────────────────────────────────
GA_POPULATION_SIZE: int = int(os.getenv("GA_POPULATION_SIZE", "50"))
GA_MAX_GENERATIONS: int = int(os.getenv("GA_MAX_GENERATIONS", "100"))
GA_MUTATION_RATE: float = float(os.getenv("GA_MUTATION_RATE", "0.05"))
GA_CROSSOVER_RATE: float = float(os.getenv("GA_CROSSOVER_RATE", "0.8"))
GA_TOURNAMENT_SIZE: int = int(os.getenv("GA_TOURNAMENT_SIZE", "5"))
GA_ELITISM_COUNT: int = int(os.getenv("GA_ELITISM_COUNT", "2"))

# ── Traffic model synthetic config ────────────────────────────────────────────
# Number of synthetic rows to generate for the traffic model when
# the aggregated source data is too small to train directly.
TRAFFIC_SYNTHETIC_ROWS: int = int(os.getenv("TRAFFIC_SYNTHETIC_ROWS", "5000"))

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT: str = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
