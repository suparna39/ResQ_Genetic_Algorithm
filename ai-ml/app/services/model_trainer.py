"""
Model trainer for all three ML models.

Trains priority classifier, hotspot regressor, and traffic regressor.
Selects the best model via cross-validation, saves artifacts, and writes
a structured report to artifacts/reports/.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import StratifiedKFold, KFold, cross_val_score

from app.core.config import (
    CV_FOLDS,
    ENCODERS_DIR,
    MODELS_DIR,
    RANDOM_SEED,
    REPORTS_DIR,
    SCALERS_DIR,
    TEST_SIZE,
    HOTSPOT_ENCODER_FILE,
    HOTSPOT_MODEL_FILE,
    HOTSPOT_SCALER_FILE,
    PRIORITY_ENCODER_FILE,
    PRIORITY_MODEL_FILE,
    PRIORITY_SCALER_FILE,
    TRAFFIC_ENCODER_FILE,
    TRAFFIC_MODEL_FILE,
    TRAFFIC_SCALER_FILE,
)
from app.core.logging import get_logger
from app.utils.metrics import classification_metrics, format_classification_report, regression_metrics

logger = get_logger(__name__)

# XGBoost is optional — import lazily so static analysers don't complain
_HAS_XGB = False
XGBClassifier = None  # type: ignore[assignment,misc]
XGBRegressor = None   # type: ignore[assignment,misc]

try:
    import importlib as _il
    _xgb = _il.import_module("xgboost")
    XGBClassifier = _xgb.XGBClassifier  # type: ignore[assignment]
    XGBRegressor = _xgb.XGBRegressor    # type: ignore[assignment]
    _HAS_XGB = True
    logger.info("XGBoost is available — will include it in model comparison")
except Exception:
    _HAS_XGB = False
    logger.info("XGBoost not found — using scikit-learn ensemble models only")


# ──────────────────────────────────────────────────────────────────────────────
# Priority model (classification)
# ──────────────────────────────────────────────────────────────────────────────

def _priority_candidates(n_classes: int) -> List[Tuple[str, Any]]:
    candidates = [
        ("RandomForest", RandomForestClassifier(
            n_estimators=300, max_depth=12, min_samples_split=4,
            class_weight="balanced", random_state=RANDOM_SEED, n_jobs=-1,
        )),
        ("GradientBoosting", GradientBoostingClassifier(
            n_estimators=200, max_depth=5, learning_rate=0.1,
            random_state=RANDOM_SEED,
        )),
    ]
    if _HAS_XGB:
        candidates.append(("XGBoost", XGBClassifier(
            n_estimators=300, max_depth=6, learning_rate=0.1,
            use_label_encoder=False, eval_metric="mlogloss",
            random_state=RANDOM_SEED, n_jobs=-1,
        )))
    return candidates


def train_priority_model(
    X: np.ndarray,
    y: np.ndarray,
    feature_names: List[str],
    encoders: Dict[str, Any],
    scaler: Any,
) -> Dict[str, Any]:
    """
    Train and evaluate priority classifier candidates. Save the best model.

    Returns a report dict.
    """
    from sklearn.model_selection import train_test_split

    n_classes = len(np.unique(y))
    candidates = _priority_candidates(n_classes)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED, stratify=y
    )

    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_SEED)
    best_name, best_model, best_score = None, None, -1.0
    cv_results: Dict[str, Dict] = {}

    for name, model in candidates:
        logger.info("Training priority model: %s", name)
        t0 = time.time()
        scores = cross_val_score(model, X_train, y_train, cv=cv, scoring="f1_macro", n_jobs=-1)
        elapsed = time.time() - t0
        mean_f1 = float(scores.mean())
        cv_results[name] = {"cv_f1_macro_mean": mean_f1, "cv_f1_macro_std": float(scores.std()), "train_time_s": elapsed}
        logger.info("  %s → CV F1-macro: %.4f ± %.4f (%.1fs)", name, mean_f1, scores.std(), elapsed)
        if mean_f1 > best_score:
            best_score, best_name, best_model = mean_f1, name, model

    # Final fit on full training set
    logger.info("Fitting best priority model (%s) on full training set", best_name)
    best_model.fit(X_train, y_train)
    y_pred = best_model.predict(X_test)

    metrics = classification_metrics(y_test, y_pred)
    report_txt = format_classification_report(y_test, y_pred)

    # Save artifacts
    joblib.dump(best_model, MODELS_DIR / PRIORITY_MODEL_FILE)
    joblib.dump(encoders, ENCODERS_DIR / PRIORITY_ENCODER_FILE)
    joblib.dump(scaler, SCALERS_DIR / PRIORITY_SCALER_FILE)

    report = {
        "model_type": "priority_classifier",
        "best_model": best_name,
        "feature_names": feature_names,
        "cv_results": cv_results,
        "test_metrics": metrics,
        "classification_report": report_txt,
    }
    _save_report("priority_model_report.json", report)
    logger.info("Priority model saved. Test F1-macro: %.4f", metrics["f1_macro"])
    return report


# ──────────────────────────────────────────────────────────────────────────────
# Hotspot model (regression)
# ──────────────────────────────────────────────────────────────────────────────

def _hotspot_candidates() -> List[Tuple[str, Any]]:
    candidates = [
        ("RandomForestRegressor", RandomForestRegressor(
            n_estimators=300, max_depth=12, random_state=RANDOM_SEED, n_jobs=-1,
        )),
        ("GradientBoostingRegressor", GradientBoostingRegressor(
            n_estimators=200, max_depth=5, learning_rate=0.05, random_state=RANDOM_SEED,
        )),
    ]
    if _HAS_XGB:
        candidates.append(("XGBoostRegressor", XGBRegressor(
            n_estimators=300, max_depth=6, learning_rate=0.05,
            random_state=RANDOM_SEED, n_jobs=-1,
        )))
    return candidates


def train_hotspot_model(
    X: np.ndarray,
    y: np.ndarray,
    feature_names: List[str],
    encoders: Dict[str, Any],
    scaler: Any,
) -> Dict[str, Any]:
    """Train and evaluate hotspot regression candidates. Save the best model."""
    from sklearn.model_selection import train_test_split

    candidates = _hotspot_candidates()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED
    )

    cv = KFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_SEED)
    best_name, best_model, best_score = None, None, float("inf")
    cv_results: Dict[str, Dict] = {}

    for name, model in candidates:
        logger.info("Training hotspot model: %s", name)
        t0 = time.time()
        # neg_root_mean_squared_error → higher (less negative) is better
        scores = cross_val_score(model, X_train, y_train, cv=cv,
                                 scoring="neg_root_mean_squared_error", n_jobs=-1)
        elapsed = time.time() - t0
        mean_rmse = float(-scores.mean())
        cv_results[name] = {"cv_rmse_mean": mean_rmse, "cv_rmse_std": float(scores.std()), "train_time_s": elapsed}
        logger.info("  %s → CV RMSE: %.4f ± %.4f (%.1fs)", name, mean_rmse, scores.std(), elapsed)
        if mean_rmse < best_score:
            best_score, best_name, best_model = mean_rmse, name, model

    logger.info("Fitting best hotspot model (%s) on full training set", best_name)
    best_model.fit(X_train, y_train)
    y_pred = best_model.predict(X_test)

    metrics = regression_metrics(y_test, y_pred)

    joblib.dump(best_model, MODELS_DIR / HOTSPOT_MODEL_FILE)
    joblib.dump(encoders, ENCODERS_DIR / HOTSPOT_ENCODER_FILE)
    joblib.dump(scaler, SCALERS_DIR / HOTSPOT_SCALER_FILE)

    report = {
        "model_type": "hotspot_regressor",
        "best_model": best_name,
        "feature_names": feature_names,
        "cv_results": cv_results,
        "test_metrics": metrics,
    }
    _save_report("hotspot_model_report.json", report)
    logger.info("Hotspot model saved. Test RMSE: %.4f", metrics["rmse"])
    return report


# ──────────────────────────────────────────────────────────────────────────────
# Traffic model (regression)
# ──────────────────────────────────────────────────────────────────────────────

def _traffic_candidates() -> List[Tuple[str, Any]]:
    candidates = [
        ("RandomForestRegressor", RandomForestRegressor(
            n_estimators=200, max_depth=8, random_state=RANDOM_SEED, n_jobs=-1,
        )),
        ("GradientBoostingRegressor", GradientBoostingRegressor(
            n_estimators=150, max_depth=4, learning_rate=0.1, random_state=RANDOM_SEED,
        )),
    ]
    if _HAS_XGB:
        candidates.append(("XGBoostRegressor", XGBRegressor(
            n_estimators=200, max_depth=5, learning_rate=0.1,
            random_state=RANDOM_SEED, n_jobs=-1,
        )))
    return candidates


def train_traffic_model(
    X: np.ndarray,
    y: np.ndarray,
    feature_names: List[str],
    encoders: Dict[str, Any],
    scaler: Any,
) -> Dict[str, Any]:
    """Train and evaluate traffic regression candidates. Save the best model."""
    from sklearn.model_selection import train_test_split

    candidates = _traffic_candidates()

    if len(X) < 20:
        logger.warning("Traffic dataset too small (%d rows). Using single RF model.", len(X))
        model = RandomForestRegressor(n_estimators=50, random_state=RANDOM_SEED)
        model.fit(X, y)
        joblib.dump(model, MODELS_DIR / TRAFFIC_MODEL_FILE)
        joblib.dump(encoders, ENCODERS_DIR / TRAFFIC_ENCODER_FILE)
        joblib.dump(scaler, SCALERS_DIR / TRAFFIC_SCALER_FILE)
        report = {"model_type": "traffic_regressor", "best_model": "RandomForestRegressor",
                  "feature_names": feature_names, "cv_results": {}, "test_metrics": {}}
        _save_report("traffic_model_report.json", report)
        return report

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED
    )

    cv = KFold(n_splits=min(CV_FOLDS, len(X_train) // 5), shuffle=True, random_state=RANDOM_SEED)
    best_name, best_model, best_score = None, None, float("inf")
    cv_results: Dict[str, Dict] = {}

    for name, model in candidates:
        logger.info("Training traffic model: %s", name)
        t0 = time.time()
        scores = cross_val_score(model, X_train, y_train, cv=cv,
                                 scoring="neg_root_mean_squared_error", n_jobs=-1)
        elapsed = time.time() - t0
        mean_rmse = float(-scores.mean())
        cv_results[name] = {"cv_rmse_mean": mean_rmse, "cv_rmse_std": float(scores.std()), "train_time_s": elapsed}
        logger.info("  %s → CV RMSE: %.4f ± %.4f (%.1fs)", name, mean_rmse, scores.std(), elapsed)
        if mean_rmse < best_score:
            best_score, best_name, best_model = mean_rmse, name, model

    best_model.fit(X_train, y_train)
    y_pred = best_model.predict(X_test)
    metrics = regression_metrics(y_test, y_pred)

    joblib.dump(best_model, MODELS_DIR / TRAFFIC_MODEL_FILE)
    joblib.dump(encoders, ENCODERS_DIR / TRAFFIC_ENCODER_FILE)
    joblib.dump(scaler, SCALERS_DIR / TRAFFIC_SCALER_FILE)

    report = {
        "model_type": "traffic_regressor",
        "best_model": best_name,
        "feature_names": feature_names,
        "cv_results": cv_results,
        "test_metrics": metrics,
    }
    _save_report("traffic_model_report.json", report)
    logger.info("Traffic model saved. Test RMSE: %.4f", metrics["rmse"])
    return report


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _save_report(filename: str, data: Dict) -> None:
    path = REPORTS_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
    logger.info("Report saved: %s", path)
