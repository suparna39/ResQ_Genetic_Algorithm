"""Utility: geographic calculations."""

import math
from app.core.constants import EARTH_RADIUS_KM, DEFAULT_URBAN_SPEED_KMH


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Compute the great-circle distance between two points on Earth.

    Parameters
    ----------
    lat1, lon1 : float
        Latitude / longitude of the first point (decimal degrees).
    lat2, lon2 : float
        Latitude / longitude of the second point (decimal degrees).

    Returns
    -------
    float
        Distance in kilometres.
    """
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def eta_minutes(distance_km: float, speed_kmh: float = DEFAULT_URBAN_SPEED_KMH,
                congestion_multiplier: float = 1.0) -> float:
    """
    Estimate travel time in minutes.

    Parameters
    ----------
    distance_km : float
        Straight-line distance between two points.
    speed_kmh : float
        Base travel speed in km/h.
    congestion_multiplier : float
        Traffic delay factor (1.0 = no delay, 2.0 = twice as slow).

    Returns
    -------
    float
        Estimated travel time in minutes.
    """
    if speed_kmh <= 0:
        speed_kmh = DEFAULT_URBAN_SPEED_KMH
    effective_speed = speed_kmh / max(congestion_multiplier, 1.0)
    # Road distance is typically ~1.3× the Haversine distance in urban areas
    road_distance_km = distance_km * 1.3
    return (road_distance_km / effective_speed) * 60.0


def congestion_to_multiplier(congestion_percent: float) -> float:
    """
    Convert a congestion percentage (0-100) to a travel-time multiplier.

    At 0 % congestion the multiplier is 1.0 (no delay).
    At 100 % congestion the multiplier is 3.0 (three times slower).
    """
    congestion_percent = max(0.0, min(100.0, congestion_percent))
    return 1.0 + (congestion_percent / 100.0) * 2.0
