"""
train.py — End-to-end training script for all three AI/ML models.

Run from the project root:
    python train.py

This script:
1. Loads all raw datasets
2. Preprocesses each dataset
3. Augments traffic data with synthetic samples if needed
4. Trains and evaluates Model 1 (Priority), Model 2 (Hotspot), Model 3 (Traffic)
5. Saves all model artifacts, encoders, and scalers
6. Writes training reports to artifacts/reports/

After running this script, the FastAPI service can be started immediately
and will load the saved artifacts without re-training.
"""

from __future__ import annotations

import sys
import time
import numpy as np

# Ensure project root is on sys.path when running as a script
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.logging import setup_logging, get_logger
from app.services.data_loader import load_priority_data, load_hotspot_data, load_traffic_data
from app.services.preprocessing import preprocess_priority, preprocess_hotspot, preprocess_traffic
from app.services.model_trainer import train_priority_model, train_hotspot_model, train_traffic_model
from app.core.config import TRAFFIC_SYNTHETIC_ROWS, RANDOM_SEED

setup_logging()
logger = get_logger("train")


def augment_traffic_data(df, n_synthetic: int = TRAFFIC_SYNTHETIC_ROWS):
    """
    Augment small traffic datasets with synthetic samples.

    The Delhi weekday stats contain only ~182 rows (13 time slots × 7 days × 2 road types).
    We augment by adding random noise to create a larger training set suitable for ML.
    """
    if len(df) >= n_synthetic:
        return df

    import pandas as pd
    rng = np.random.default_rng(RANDOM_SEED)

    extra_rows = []
    for _ in range(n_synthetic - len(df)):
        base = df.sample(1).iloc[0].to_dict()
        # Add realistic noise
        noise_cong = rng.normal(0, 3)
        noise_speed = rng.normal(0, 2)
        base["congestion_pct"] = float(np.clip(base["congestion_pct"] + noise_cong, 0, 100))
        base["speed_kmh"] = float(max(5, base.get("speed_kmh", 25) + noise_speed))
        base["monthly_avg_congestion"] = float(np.clip(
            base.get("monthly_avg_congestion", 33) + rng.normal(0, 2), 0, 100
        ))
        extra_rows.append(base)

    synthetic = pd.DataFrame(extra_rows)
    augmented = pd.concat([df, synthetic], ignore_index=True)
    logger.info("Traffic dataset augmented: %d → %d rows", len(df), len(augmented))
    return augmented


def train_all():
    total_start = time.time()
    reports = {}

    # ── Model 1: Priority ──────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("TRAINING MODEL 1: Emergency Priority Prediction")
    logger.info("=" * 60)
    t0 = time.time()
    df_priority = load_priority_data()
    X_p, y_p, feat_p, enc_p, scaler_p = preprocess_priority(df_priority, fit=True)
    reports["priority"] = train_priority_model(X_p, y_p, feat_p, enc_p, scaler_p)
    logger.info("Model 1 done in %.1fs", time.time() - t0)

    # ── Model 2: Hotspot ───────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("TRAINING MODEL 2: Emergency Hotspot Prediction")
    logger.info("=" * 60)
    t0 = time.time()
    df_hotspot = load_hotspot_data()
    X_h, y_h, feat_h, enc_h, scaler_h = preprocess_hotspot(df_hotspot, fit=True)
    reports["hotspot"] = train_hotspot_model(X_h, y_h, feat_h, enc_h, scaler_h)
    logger.info("Model 2 done in %.1fs", time.time() - t0)

    # ── Model 3: Traffic ───────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("TRAINING MODEL 3: Traffic Congestion Estimation")
    logger.info("=" * 60)
    t0 = time.time()
    df_traffic = load_traffic_data()
    df_traffic = augment_traffic_data(df_traffic)
    X_t, y_t, feat_t, enc_t, scaler_t = preprocess_traffic(df_traffic, fit=True)
    reports["traffic"] = train_traffic_model(X_t, y_t, feat_t, enc_t, scaler_t)
    logger.info("Model 3 done in %.1fs", time.time() - t0)

    # ── Summary ────────────────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("TRAINING COMPLETE in %.1fs", time.time() - total_start)
    logger.info("=" * 60)

    for model_name, report in reports.items():
        logger.info("\n[%s]", model_name.upper())
        logger.info("  Best model  : %s", report.get("best_model", "N/A"))
        metrics = report.get("test_metrics", {})
        for k, v in metrics.items():
            logger.info("  %-20s: %.4f", k, v)

    logger.info("\nAll artifacts saved in artifacts/")
    logger.info("Start the API with:  uvicorn app.main:app --reload")


if __name__ == "__main__":
    train_all()
