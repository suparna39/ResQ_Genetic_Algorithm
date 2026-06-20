/**
 * Road-network graph builder for the Dijkstra route-search visualisation.
 *
 * Fetches the real street network around the driver↔patient area from the
 * OpenStreetMap Overpass API, builds a weighted graph (nodes = intersections /
 * road vertices, edges = road segments weighted by metric length), and snaps
 * the driver/patient coordinates to the nearest graph nodes.
 *
 * If Overpass is unreachable (rate-limited, offline, CORS), it falls back to a
 * synthetic grid mesh covering the same bounding box so the visualisation
 * always has a network to flood — it never crashes.
 */

export interface RoadGraph {
  /** [lng, lat] per node. */
  coords: [number, number][];
  /** Flat adjacency: adj[i] = [neighborIdx, weightMeters, ...]. */
  adj: number[][];
  /** Node count. */
  n: number;
  /** true when the synthetic fallback mesh was used. */
  synthetic: boolean;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Highway classes worth routing on (skip footways, cycleways, etc. for a
// vehicle dispatch — keeps the graph smaller and the flood cleaner).
const DRIVABLE =
  '["highway"~"motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|road"]';

function metersBetween(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

interface BBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

function boundingBox(
  from: [number, number],
  to: [number, number],
  padFactor = 0.35
): BBox {
  const [fLng, fLat] = from;
  const [tLng, tLat] = to;
  const minLat = Math.min(fLat, tLat);
  const maxLat = Math.max(fLat, tLat);
  const minLng = Math.min(fLng, tLng);
  const maxLng = Math.max(fLng, tLng);
  const padLat = Math.max((maxLat - minLat) * padFactor, 0.004);
  const padLng = Math.max((maxLng - minLng) * padFactor, 0.004);
  return {
    minLat: minLat - padLat,
    minLng: minLng - padLng,
    maxLat: maxLat + padLat,
    maxLng: maxLng + padLng,
  };
}

/** Build the Overpass QL query for drivable ways in a bbox. */
function overpassQuery(b: BBox): string {
  // (south,west,north,east)
  const bbox = `${b.minLat},${b.minLng},${b.maxLat},${b.maxLng}`;
  return `[out:json][timeout:25];(way${DRIVABLE}(${bbox}););out geom;`;
}

async function fetchOverpass(query: string, signal?: AbortSignal): Promise<any | null> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Overpass rejects requests without a User-Agent (HTTP 406).
          // Browsers normally set this automatically, but be explicit.
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.elements?.length) return json;
    } catch {
      // try next endpoint
    }
  }
  return null;
}

/**
 * Convert an Overpass `out geom` response into a deduplicated weighted graph.
 * Nodes are keyed by rounded lng,lat so shared road vertices merge into one.
 */
function buildGraphFromOverpass(json: any): RoadGraph | null {
  const ways = (json.elements || []).filter(
    (e: any) => e.type === 'way' && Array.isArray(e.geometry) && e.geometry.length > 1
  );
  if (ways.length === 0) return null;

  const coords: [number, number][] = [];
  const adj: number[][] = [];
  const index = new Map<string, number>();

  const key = (lng: number, lat: number) =>
    `${lng.toFixed(6)},${lat.toFixed(6)}`;

  const getNode = (lng: number, lat: number): number => {
    const k = key(lng, lat);
    let id = index.get(k);
    if (id === undefined) {
      id = coords.length;
      coords.push([lng, lat]);
      adj.push([]);
      index.set(k, id);
    }
    return id;
  };

  const addEdge = (a: number, b: number, w: number) => {
    if (a === b) return;
    adj[a].push(b, w);
    adj[b].push(a, w); // treat all roads as bidirectional for the visualisation
  };

  for (const way of ways) {
    const geom = way.geometry as { lat: number; lon: number }[];
    let prevId = getNode(geom[0].lon, geom[0].lat);
    for (let i = 1; i < geom.length; i++) {
      const curId = getNode(geom[i].lon, geom[i].lat);
      const w = metersBetween(coords[prevId], coords[curId]);
      addEdge(prevId, curId, w);
      prevId = curId;
    }
  }

  if (coords.length < 2) return null;
  return { coords, adj, n: coords.length, synthetic: false };
}

/**
 * Synthetic fallback: a grid mesh (with diagonals) spanning the bbox.
 * Looks network-like enough for the flood animation when Overpass is down.
 */
function buildSyntheticGraph(b: BBox, cols = 26, rows = 26): RoadGraph {
  const coords: [number, number][] = [];
  const adj: number[][] = [];
  const idAt = (r: number, c: number) => r * cols + c;

  // small deterministic jitter so it doesn't look like a perfect lattice
  const jitter = (seed: number) => (Math.sin(seed * 12.9898) * 43758.5453 % 1) * 0.00018;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lng = b.minLng + ((b.maxLng - b.minLng) * c) / (cols - 1) + jitter(r * cols + c);
      const lat = b.minLat + ((b.maxLat - b.minLat) * r) / (rows - 1) + jitter(r * cols + c + 7);
      coords.push([lng, lat]);
      adj.push([]);
    }
  }

  const link = (a: number, bi: number) => {
    const w = metersBetween(coords[a], coords[bi]);
    adj[a].push(bi, w);
    adj[bi].push(a, w);
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = idAt(r, c);
      if (c + 1 < cols) link(id, idAt(r, c + 1));
      if (r + 1 < rows) link(id, idAt(r + 1, c));
      // sparse diagonals for a more organic flood front
      if (r + 1 < rows && c + 1 < cols && (r + c) % 2 === 0) link(id, idAt(r + 1, c + 1));
    }
  }

  return { coords, adj, n: coords.length, synthetic: true };
}

/** Nearest graph node to a given [lng, lat]. */
export function nearestNode(graph: RoadGraph, lng: number, lat: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < graph.n; i++) {
    const dx = graph.coords[i][0] - lng;
    const dy = graph.coords[i][1] - lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Build a routable road graph around the driver→patient corridor.
 *
 * @param from [lng, lat] driver
 * @param to   [lng, lat] patient
 */
export async function buildRoadGraph(
  from: [number, number],
  to: [number, number],
  signal?: AbortSignal
): Promise<RoadGraph> {
  const bbox = boundingBox(from, to);

  // Span guard: Overpass can't sensibly return a street network across a huge
  // area (e.g. cross-city / cross-state). For long spans, skip the doomed/slow
  // call and use a dense synthetic mesh so the flood still renders instantly.
  const spanKm = metersBetween(from, to) / 1000;
  if (spanKm > 25) {
    return buildSyntheticGraph(bbox, 34, 34);
  }

  const json = await fetchOverpass(overpassQuery(bbox), signal);
  if (json) {
    const g = buildGraphFromOverpass(json);
    if (g) return g;
  }
  return buildSyntheticGraph(bbox);
}
