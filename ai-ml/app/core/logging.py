"""
Centralized logging setup for the AI Ambulance Allocation Service.
"""

import logging
import sys
from app.core.config import LOG_LEVEL, LOG_FORMAT


def get_logger(name: str) -> logging.Logger:
    """Return a configured logger for the given module name."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(LOG_FORMAT))
        logger.addHandler(handler)
    logger.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))
    # Prevent double-logging: don't propagate to the root logger
    logger.propagate = False
    return logger


def setup_logging() -> None:
    """Configure root logging for the entire application."""
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
        format=LOG_FORMAT,
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    # Suppress noisy third-party loggers
    for noisy in ("uvicorn.access", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    # Suppress sklearn feature-name warnings that appear when scaler
    # was fitted with a DataFrame but transform receives a numpy array.
    # (Fixed at source in *_service.py — this is a belt-and-suspenders guard.)
    import warnings
    warnings.filterwarnings(
        "ignore",
        message="X does not have valid feature names",
        category=UserWarning,
        module="sklearn",
    )
