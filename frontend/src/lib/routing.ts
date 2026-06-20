/**
 * Road routing helper.
 *
 * Fetches a driving route between two points from the public OSRM demo server
 * (OpenStreetMap-based, no API key required) and returns the geometry in the
 * [lng, lat][] format that LiveMap's `route` prop expects.
 *
 * Falls back to a straight line between the two points if the routing service
 * is unreachable, so the map always shows *something* connecting driver↔patient.
 */

export interface RouteResult {
  /** Polyline geometry as [lng, lat] pairs (MapLibre order). */
  coordinates: [number, number][];
  /** Road distance in kilometres. */
  distanceKm: number;
  /** Estimated driving duration in minutes (free-flow, before traffic). */
  durationMin: number;
  /** true when the straight-line fallback was used. */
  fallback: boolean;
}

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Get a driving route between an origin and destination.
 *
 * @param from [lat, lng] origin
 * @param to   [lat, lng] destination
 */
export async function getRoute(
  from: [number, number],
  to: [number, number],
  signal?: AbortSignal
): Promise<RouteResult> {
  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;

  // OSRM expects lng,lat;lng,lat
  const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) throw new Error('no route geometry');

    return {
      coordinates: route.geometry.coordinates as [number, number][],
      distanceKm: (route.distance ?? 0) / 1000,
      durationMin: (route.duration ?? 0) / 60,
      fallback: false,
    };
  } catch {
    // Straight-line fallback
    return {
      coordinates: [
        [fromLng, fromLat],
        [toLng, toLat],
      ],
      distanceKm: haversineKm(fromLat, fromLng, toLat, toLng),
      durationMin: 0,
      fallback: true,
    };
  }
}

/** Great-circle distance in km (fallback distance estimate). */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
