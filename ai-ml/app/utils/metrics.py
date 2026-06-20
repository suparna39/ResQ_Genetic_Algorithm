"""Utility: evaluation metrics helpers."""

from __future__ import annotations

from typing import Any, Dict

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    recall_score,
)


def classification_metrics(y_true: Any, y_pred: Any, labels: list | None = None) -> Dict[str, float]:
    """Compute accuracy, precision, recall, and macro F1 for a classifier."""
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "precision_macro": float(precision_score(y_true, y_pred, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(y_true, y_pred, average="macro", zero_division=0)),
    }


def regression_metrics(y_true: Any, y_pred: Any) -> Dict[str, float]:
    """Compute RMSE and MAE for a regression model."""
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    mae = float(mean_absolute_error(y_true, y_pred))
    return {"rmse": rmse, "mae": mae}


def format_classification_report(y_true: Any, y_pred: Any) -> str:
    """Return sklearn's full classification report as a string."""
    return classification_report(y_true, y_pred, zero_division=0)
