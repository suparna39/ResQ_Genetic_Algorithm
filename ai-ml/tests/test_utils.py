"""
tests/test_utils.py — Unit tests for utility modules.
"""

from __future__ import annotations

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1]))

import pytest
from app.utils.geo_utils import haversine_km, eta_minutes, congestion_to_multiplier
from app.utils.helpers import (
    safe_int, safe_float, extract_numeric, percent_to_float,
    flatten_dict, hour_to_period, is_rush_hour,
)
from app.utils.feature_engineering import (
    extract_hour, encode_weather, encode_road_condition,
    encode_road_type, encode_visibility, encode_traffic_density,
    normalize_column_names, add_time_features, label_encode_column,
)
import pandas as pd


class TestGeoUtils:
    def test_same_point_distance_zero(self):
        assert haversine_km(28.6, 77.2, 28.6, 77.2) == pytest.approx(0.0, abs=1e-9)

    def test_known_distance_delhi_mumbai(self):
        # Delhi ↔ Mumbai ~1148 km
        d = haversine_km(28.6139, 77.2090, 19.0760, 72.8777)
        assert 1100 < d < 1200, f"Expected ~1148 km, got {d:.1f}"

    def test_eta_increases_with_congestion(self):
        eta_clear = eta_minutes(5.0, speed_kmh=40, congestion_multiplier=1.0)
        eta_heavy = eta_minutes(5.0, speed_kmh=40, congestion_multiplier=2.5)
        assert eta_heavy > eta_clear

    def test_eta_positive(self):
        assert eta_minutes(10.0) > 0

    def test_congestion_multiplier_bounds(self):
        assert congestion_to_multiplier(0) == pytest.approx(1.0)
        assert congestion_to_multiplier(100) == pytest.approx(3.0)
        assert 1.0 <= congestion_to_multiplier(50) <= 3.0


class TestHelpers:
    def test_safe_int_valid(self):
        assert safe_int("5") == 5
        assert safe_int(3.7) == 3

    def test_safe_int_invalid(self):
        assert safe_int("abc", default=99) == 99

    def test_safe_float_valid(self):
        assert safe_float("3.14") == pytest.approx(3.14)

    def test_extract_numeric(self):
        assert extract_numeric("25 km/h") == pytest.approx(25.0)
        assert extract_numeric("43%") == pytest.approx(43.0)

    def test_percent_to_float(self):
        assert percent_to_float("43%") == pytest.approx(0.43)
        assert percent_to_float("0%") == pytest.approx(0.0)

    def test_flatten_dict(self):
        d = {"a": {"b": 1, "c": {"d": 2}}}
        flat = flatten_dict(d)
        assert "a__b" in flat
        assert "a__c__d" in flat

    def test_hour_to_period(self):
        assert hour_to_period(9) == "morning"
        assert hour_to_period(14) == "afternoon"
        assert hour_to_period(19) == "evening"
        assert hour_to_period(2) == "night"

    def test_is_rush_hour(self):
        assert is_rush_hour(8, is_weekend=False)
        assert is_rush_hour(18, is_weekend=False)
        assert not is_rush_hour(8, is_weekend=True)
        assert not is_rush_hour(3)


class TestFeatureEngineering:
    def test_extract_hour(self):
        assert extract_hour("8:30") == 8
        assert extract_hour("21:15") == 21
        assert extract_hour("0:0") == 0

    def test_encode_weather(self):
        assert encode_weather("clear") == 0
        assert encode_weather("foggy") == 1
        assert encode_weather("rainy") == 2
        assert encode_weather("stormy") == 3

    def test_encode_road_condition(self):
        assert encode_road_condition("dry") == 0
        assert encode_road_condition("wet") == 1

    def test_encode_road_type(self):
        assert encode_road_type("urban road") == 2
        assert encode_road_type("national highway") == 0

    def test_encode_visibility(self):
        assert encode_visibility("high") == 0
        assert encode_visibility("low") == 2

    def test_encode_traffic_density(self):
        assert encode_traffic_density("low") == 0
        assert encode_traffic_density("high") == 2

    def test_normalize_column_names(self):
        df = pd.DataFrame(columns=["State Name", "City (Name)", " Road Type "])
        norm = normalize_column_names(df)
        assert "state_name" in norm.columns
        assert "city_name" in norm.columns
        assert "road_type" in norm.columns

    def test_add_time_features(self):
        df = pd.DataFrame({"time_of_day": ["8:30", "21:00"], "dummy": [1, 2]})
        result = add_time_features(df, time_col="time_of_day")
        assert "hour" in result.columns
        assert "is_rush_hour" in result.columns
        assert result["hour"].iloc[0] == 8
        assert result["is_rush_hour"].iloc[0] == 1  # 8 AM is rush hour

    def test_label_encode_column(self):
        s = pd.Series(["cat", "dog", "cat", "bird"])
        encoded, mapping = label_encode_column(s)
        assert len(mapping) == 3
        assert encoded.nunique() == 3
        # Round-trip
        reverse = {v: k for k, v in mapping.items()}
        assert reverse[encoded.iloc[0]] == "cat"
