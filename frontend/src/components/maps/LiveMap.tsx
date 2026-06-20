'use client';

import { useEffect, useRef, useState, useId } from 'react';

interface Marker {
  lat: number;
  lng: number;
  type: 'patient' | 'ambulance' | 'hospital';
  label?: string;
}

interface Route {
  coordinates: [number, number][]; // [lng, lat] pairs
}

/**
 * Dijkstra search-flood animation payload. Bump `runId` to (re)start the flood.
 *  - segments : road segments in the order Dijkstra settled them
 *  - source   : [lng, lat] gold origin dot (driver)
 *  - target   : [lng, lat] green destination dot (patient)
 */
interface SearchViz {
  segments: [number, number][][];
  source: [number, number];
  target: [number, number];
  runId: number;
}

/**
 * Genetic-Algorithm candidate-scan animation payload. Bump `runId` to (re)play.
 * Visualises the GA evaluating every available unit before locking the winner:
 *  - patient   : [lng, lat] emergency origin
 *  - candidates: every available ambulance with its position + winner flag
 */
interface GAScanViz {
  patient: [number, number];
  candidates: { lng: number; lat: number; isWinner: boolean; fitness: number | null }[];
  runId: number;
}

interface LiveMapProps {
  center: [number, number]; // [lat, lng] — only used for initial map creation
  zoom?: number;            // only used for initial map creation
  markers?: Marker[];
  route?: Route;
  search?: SearchViz | null;
  /** Fired once the flood reaches the target / finishes. */
  onSearchComplete?: () => void;
  /** GA candidate-scan animation (plays before the route flood). */
  gaScan?: GAScanViz | null;
  /** Fired once the GA scan animation completes. */
  onGAScanComplete?: () => void;
  height?: string;
}

function buildStyle() {
  return {
    version: 8 as const,
    sources: {
      carto: {
        type: 'raster' as const,
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      },
    },
    layers: [{ id: 'carto-dark', type: 'raster' as const, source: 'carto' }],
  };
}

function createMarkerEl(type: Marker['type']): HTMLElement {
  const el = document.createElement('div');
  el.style.cursor = 'pointer';
  el.style.transition = 'transform 0.2s ease';
  el.style.filter = 'drop-shadow(0 3px 10px rgba(0,0,0,0.95))';
  el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.18)'; });
  el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

  const cfg: Record<Marker['type'], { emoji: string; bg: string; border: string; size: number }> = {
    patient:   { emoji: '🚨', bg: '#EDEDED', border: '#050505', size: 40 },
    ambulance: { emoji: '🚑', bg: '#111111', border: '#EDEDED', size: 44 },
    hospital:  { emoji: '🏥', bg: '#0A0A0A', border: '#7A7A7A', size: 36 },
  };
  const { emoji, bg, border, size } = cfg[type];
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2-2}" fill="${bg}" stroke="${border}" stroke-width="2.5"/>
      <text x="${size/2}" y="${size/2+6}" text-anchor="middle" font-size="${Math.round(size*0.44)}">${emoji}</text>
    </svg>`;
  return el;
}

// Key by type only — one of each at most, so position updates reuse the
// same MapLibre Marker instance via setLngLat() (smooth, no flicker).
const markerKey = (m: Marker) => m.type;

export default function LiveMap({
  center,
  zoom = 14,
  markers = [],
  route,
  search,
  onSearchComplete,
  gaScan,
  onGAScanComplete,
  height = '400px',
}: LiveMapProps) {
  const uid = useId().replace(/:/g, '-');
  const containerRef = useRef<HTMLDivElement>(null);

  const mapRef    = useRef<any>(null);
  const mlRef     = useRef<typeof import('maplibre-gl') | null>(null);

  // type → MapLibre Marker instance
  const markerMapRef  = useRef<Map<string, any>>(new Map());
  const activeKeysRef = useRef<Set<string>>(new Set());

  // Fire fitBounds ONCE when both patient + ambulance are on the map together.
  // After that the user can zoom/pan freely without interference.
  const hasFittedBothRef = useRef(false);
  // Same idea for the route: fit to the route once, never snap again.
  const hasFittedRouteRef = useRef(false);

  // Dijkstra flood animation bookkeeping.
  const searchRafRef = useRef<number | null>(null);
  const lastRunIdRef = useRef<number>(-1);
  const onSearchCompleteRef = useRef(onSearchComplete);
  onSearchCompleteRef.current = onSearchComplete;

  // GA candidate-scan animation bookkeeping.
  const gaRafRef = useRef<number | null>(null);
  const lastGaRunIdRef = useRef<number>(-1);
  const onGAScanCompleteRef = useRef(onGAScanComplete);
  onGAScanCompleteRef.current = onGAScanComplete;

  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // ─── Init map (runs once) ─────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!containerRef.current || mapRef.current) return;

      const ml = await import('maplibre-gl');
      await import('maplibre-gl/dist/maplibre-gl.css');
      if (!mounted || !containerRef.current) return;

      mlRef.current = ml;

      try {
        const map = new ml.Map({
          container: containerRef.current,
          style: buildStyle() as any,
          center: [center[1], center[0]], // [lng, lat]
          zoom,
          attributionControl: false,
          fadeDuration: 150,
        });

        map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right');
        map.addControl(new ml.NavigationControl({ showCompass: false }), 'bottom-right');

        map.on('load', () => {
          if (mounted) { mapRef.current = map; setIsLoaded(true); }
        });
        map.on('error', (e: any) => console.warn('[LiveMap]', e));
      } catch (err) {
        console.error('[LiveMap] init failed:', err);
        if (mounted) setHasError(true);
      }
    })();

    return () => {
      mounted = false;
      if (searchRafRef.current) {
        cancelAnimationFrame(searchRafRef.current);
        searchRafRef.current = null;
      }
      if (gaRafRef.current) {
        cancelAnimationFrame(gaRafRef.current);
        gaRafRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerMapRef.current.clear();
        activeKeysRef.current.clear();
        hasFittedBothRef.current = false;
        hasFittedRouteRef.current = false;
        setIsLoaded(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← intentionally empty: center/zoom only apply at creation time

  // ─── Markers — smart diff, NO full destroy/recreate ──────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const ml  = mlRef.current;
    if (!map || !ml || !isLoaded) return;

    const incomingKeys = new Set<string>();

    markers.forEach((marker) => {
      const key = markerKey(marker);
      incomingKeys.add(key);

      if (markerMapRef.current.has(key)) {
        // Already on map — reposition smoothly (no DOM teardown)
        markerMapRef.current.get(key).setLngLat([marker.lng, marker.lat]);
      } else {
        // New marker type — create once
        const el = createMarkerEl(marker.type);
        const mapMarker = new ml.Marker({ element: el, anchor: 'center' })
          .setLngLat([marker.lng, marker.lat])
          .addTo(map);

        if (marker.label) {
          const popup = new ml.Popup({
            offset: 24, closeButton: false, closeOnClick: false, maxWidth: '240px',
          }).setHTML(
            `<div style="background:#111;color:#EDEDED;border:1px solid #2A2A2A;padding:6px 12px;border-radius:6px;font-family:ui-monospace,monospace;font-size:11px;white-space:nowrap">${marker.label}</div>`
          );
          el.addEventListener('click', () => {
            mapMarker.getPopup()?.isOpen()
              ? mapMarker.getPopup()?.remove()
              : (mapMarker.setPopup(popup), mapMarker.togglePopup());
          });
        }

        markerMapRef.current.set(key, mapMarker);
        activeKeysRef.current.add(key);
      }
    });

    // Remove markers that are no longer in the incoming list
    const toRemove: string[] = [];
    for (const key of activeKeysRef.current) {
      if (!incomingKeys.has(key)) toRemove.push(key);
    }
    toRemove.forEach((key) => {
      markerMapRef.current.get(key)?.remove();
      markerMapRef.current.delete(key);
    });
    activeKeysRef.current = incomingKeys;

    // ── One-time fitBounds when both patient + ambulance are visible ────────
    // This gives the user a perfect initial view of both pins.
    // After this fires once, the user can zoom/pan freely — we never auto-pan again.
    if (!hasFittedBothRef.current && incomingKeys.size >= 2) {
      hasFittedBothRef.current = true;
      const lats = markers.map((m) => m.lat);
      const lngs = markers.map((m) => m.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      // Only fit if markers are actually at different positions
      const latDiff = maxLat - minLat;
      const lngDiff = maxLng - minLng;
      if (latDiff > 0.0001 || lngDiff > 0.0001) {
        map.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { padding: 100, duration: 700, maxZoom: 15 }
        );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, isLoaded]);

  // ─── Route polyline ────────────────────────────────────────────────────────
  // Smart update: create the source/layers once, then only swap the GeoJSON data
  // on subsequent route changes. fitBounds runs ONCE (first non-empty route) so
  // the user's zoom/pan is never snapped back on live route updates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    const SRC = 'live-route', GLOW = 'live-route-glow', LINE = 'live-route-line';

    // No route → tear down any existing layers/source and reset the fit flag.
    if (!route?.coordinates?.length) {
      [GLOW, LINE].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(SRC)) map.removeSource(SRC);
      hasFittedRouteRef.current = false;
      return;
    }

    const geojson = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: route.coordinates },
    };

    const existing = map.getSource(SRC);
    if (existing) {
      // Smooth update — just replace the line data, no layer churn.
      existing.setData(geojson);
    } else {
      map.addSource(SRC, { type: 'geojson', data: geojson });
      map.addLayer({ id: GLOW, type: 'line', source: SRC,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#EDEDED', 'line-width': 10, 'line-opacity': 0.1, 'line-blur': 6 } });
      map.addLayer({ id: LINE, type: 'line', source: SRC,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#EDEDED', 'line-width': 2.5, 'line-opacity': 0.8 } });
    }

    // Fit to the full route exactly once.
    if (!hasFittedRouteRef.current) {
      hasFittedRouteRef.current = true;
      const lngs = route.coordinates.map(([lng]) => lng);
      const lats = route.coordinates.map(([, lat]) => lat);
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 60, duration: 700, maxZoom: 16 }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, isLoaded]);

  // ─── GA candidate-scan animation ───────────────────────────────────────────
  // When `gaScan` is provided with a new runId, sweep a pulsing scan line from
  // the patient to each candidate ambulance (the GA "evaluating" each unit),
  // then lock onto the winner with a glowing ring. Purely additive — it shares
  // the map with the Dijkstra flood + route but uses its own layers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    if (!gaScan || !gaScan.candidates?.length) return;
    if (gaScan.runId === lastGaRunIdRef.current) return;
    lastGaRunIdRef.current = gaScan.runId;

    const SRC_LINKS = 'ga-links';
    const SRC_NODES = 'ga-nodes';
    const SRC_WIN = 'ga-winner';
    const L_LINKS = 'ga-links-line';
    const L_NODES = 'ga-nodes-pt';
    const L_WIN_GLOW = 'ga-winner-glow';
    const L_WIN = 'ga-winner-pt';

    const emptyFC = () => ({ type: 'FeatureCollection' as const, features: [] as any[] });

    const clear = () => {
      [L_LINKS, L_NODES, L_WIN_GLOW, L_WIN].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
      [SRC_LINKS, SRC_NODES, SRC_WIN].forEach((id) => { if (map.getSource(id)) map.removeSource(id); });
    };

    if (gaRafRef.current) cancelAnimationFrame(gaRafRef.current);
    clear();

    map.addSource(SRC_LINKS, { type: 'geojson', data: emptyFC() });
    map.addLayer({
      id: L_LINKS, type: 'line', source: SRC_LINKS,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#b9b9e6', 'line-width': 1.6, 'line-opacity': 0.55, 'line-dasharray': [2, 2] },
    });
    map.addSource(SRC_NODES, { type: 'geojson', data: emptyFC() });
    map.addLayer({
      id: L_NODES, type: 'circle', source: SRC_NODES,
      paint: {
        'circle-radius': 5,
        'circle-color': '#8f8fb8',
        'circle-blur': 0.4,
        'circle-opacity': 0.9,
        'circle-stroke-width': 2,
        'circle-stroke-color': 'rgba(180,180,220,0.3)',
      },
    });
    map.addSource(SRC_WIN, { type: 'geojson', data: emptyFC() });
    map.addLayer({
      id: L_WIN_GLOW, type: 'circle', source: SRC_WIN,
      paint: { 'circle-radius': 16, 'circle-color': '#e8e8f4', 'circle-blur': 1, 'circle-opacity': 0.35 },
    });
    map.addLayer({
      id: L_WIN, type: 'circle', source: SRC_WIN,
      paint: {
        'circle-radius': 7, 'circle-color': '#f4f4fb', 'circle-opacity': 0.95,
        'circle-stroke-width': 3, 'circle-stroke-color': 'rgba(220,220,250,0.45)',
      },
    });

    const patient = gaScan.patient;
    const cands = gaScan.candidates;
    const total = cands.length;
    const PER = 520;            // ms per candidate scan
    const DURATION = Math.min(4200, Math.max(1600, total * PER));
    const start = performance.now();

    const linkFeature = (c: { lng: number; lat: number }) => ({
      type: 'Feature' as const, properties: {},
      geometry: { type: 'LineString' as const, coordinates: [patient, [c.lng, c.lat]] },
    });
    const nodeFeature = (c: { lng: number; lat: number }) => ({
      type: 'Feature' as const, properties: {},
      geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
    });

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const revealed = Math.max(1, Math.floor(t * total));
      const shown = cands.slice(0, revealed);
      map.getSource(SRC_LINKS)?.setData({ type: 'FeatureCollection', features: shown.map(linkFeature) });
      map.getSource(SRC_NODES)?.setData({ type: 'FeatureCollection', features: shown.map(nodeFeature) });

      if (t < 1) {
        gaRafRef.current = requestAnimationFrame(tick);
      } else {
        // Lock the winner
        const winner = cands.find((c) => c.isWinner) ?? cands[0];
        map.getSource(SRC_WIN)?.setData({
          type: 'FeatureCollection',
          features: [nodeFeature(winner)],
        });
        // Fade the scan web so the winner reads clearly
        if (map.getLayer(L_LINKS)) map.setPaintProperty(L_LINKS, 'line-opacity', 0.18);
        if (map.getLayer(L_NODES)) map.setPaintProperty(L_NODES, 'circle-opacity', 0.4);
        gaRafRef.current = null;
        onGAScanCompleteRef.current?.();
      }
    };
    gaRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (gaRafRef.current) { cancelAnimationFrame(gaRafRef.current); gaRafRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaScan?.runId, isLoaded]);

  // Clear GA scan layers when dismissed (gaScan = null).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    if (gaScan) return;
    if (gaRafRef.current) { cancelAnimationFrame(gaRafRef.current); gaRafRef.current = null; }
    lastGaRunIdRef.current = -1;
    ['ga-links-line', 'ga-nodes-pt', 'ga-winner-glow', 'ga-winner-pt'].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    ['ga-links', 'ga-nodes', 'ga-winner'].forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaScan, isLoaded]);

  // ─── Dijkstra search flood-fill animation ──────────────────────────────────
  // When `search` is provided with a new runId, animate the exploration of the
  // road network from the source (gold) outward until it reaches the target
  // (green) — the classic Dijkstra visualisation. On completion, onSearchComplete
  // fires so the caller can reveal the final route.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    if (!search || !search.segments?.length) return;
    if (search.runId === lastRunIdRef.current) return; // already played this run
    lastRunIdRef.current = search.runId;

    const EXPLORED = 'dijkstra-explored';
    const FRONTIER = 'dijkstra-frontier';
    const ENDPTS = 'dijkstra-endpoints';
    const L_EXPLORED_GLOW = 'dijkstra-explored-glow';
    const L_EXPLORED = 'dijkstra-explored-line';
    const L_FRONTIER = 'dijkstra-frontier-line';
    const L_ENDPTS = 'dijkstra-endpoints-pts';

    const emptyFC = () => ({ type: 'FeatureCollection' as const, features: [] as any[] });

    const ensureLayers = () => {
      if (!map.getSource(EXPLORED)) {
        map.addSource(EXPLORED, { type: 'geojson', data: emptyFC() });
        // Soft blue glow under the explored web
        map.addLayer({
          id: L_EXPLORED_GLOW, type: 'line', source: EXPLORED,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#1E4Fff', 'line-width': 4, 'line-opacity': 0.25, 'line-blur': 3 },
        });
        // Crisp explored edges
        map.addLayer({
          id: L_EXPLORED, type: 'line', source: EXPLORED,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#3B82F6', 'line-width': 1.4, 'line-opacity': 0.7 },
        });
      }
      if (!map.getSource(FRONTIER)) {
        map.addSource(FRONTIER, { type: 'geojson', data: emptyFC() });
        // Bright leading edge of the flood
        map.addLayer({
          id: L_FRONTIER, type: 'line', source: FRONTIER,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#7DD3FC', 'line-width': 2.4, 'line-opacity': 0.95, 'line-blur': 0.4 },
        });
      }
      if (!map.getSource(ENDPTS)) {
        map.addSource(ENDPTS, { type: 'geojson', data: emptyFC() });
        map.addLayer({
          id: L_ENDPTS, type: 'circle', source: ENDPTS,
          paint: {
            'circle-radius': ['case', ['==', ['get', 'role'], 'source'], 7, 8],
            'circle-color': ['case', ['==', ['get', 'role'], 'source'], '#FFD23F', '#22C55E'],
            'circle-blur': 0.5,
            'circle-opacity': 0.95,
            'circle-stroke-width': ['case', ['==', ['get', 'role'], 'source'], 3, 3],
            'circle-stroke-color': ['case', ['==', ['get', 'role'], 'source'], 'rgba(255,210,63,0.35)', 'rgba(34,197,94,0.35)'],
          },
        });
      }
    };

    const clearViz = () => {
      [L_EXPLORED_GLOW, L_EXPLORED, L_FRONTIER, L_ENDPTS].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      [EXPLORED, FRONTIER, ENDPTS].forEach((id) => {
        if (map.getSource(id)) map.removeSource(id);
      });
    };

    // Fresh start
    if (searchRafRef.current) cancelAnimationFrame(searchRafRef.current);
    clearViz();
    ensureLayers();

    const segments = search.segments;
    const total = segments.length;

    // Endpoints (gold source + green target) — drawn for the whole animation.
    map.getSource(ENDPTS)?.setData({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { role: 'source' }, geometry: { type: 'Point', coordinates: search.source } },
        { type: 'Feature', properties: { role: 'target' }, geometry: { type: 'Point', coordinates: search.target } },
      ],
    });

    // Frame in on the search area once.
    {
      const lngs: number[] = [search.source[0], search.target[0]];
      const lats: number[] = [search.source[1], search.target[1]];
      for (const seg of segments) for (const [lng, lat] of seg) { lngs.push(lng); lats.push(lat); }
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 70, duration: 600, maxZoom: 16 }
      );
    }

    // Reveal ~7.5s total regardless of graph size, with a bright frontier band.
    // Slower pace gives the search a deliberate, dramatic "feel".
    const DURATION_MS = 7500;
    const FRONTIER_BAND = Math.max(12, Math.round(total * 0.05));
    const exploredFeatures: any[] = [];
    let revealed = 0;
    const start = performance.now();

    const lineFeature = (seg: [number, number][]) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: seg },
    });

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      // ease-out so the flood bursts quickly then settles
      const eased = 1 - Math.pow(1 - t, 2);
      const target = Math.floor(eased * total);

      // Append newly explored edges to the explored web.
      for (; revealed < target; revealed++) {
        exploredFeatures.push(lineFeature(segments[revealed]));
      }
      map.getSource(EXPLORED)?.setData({ type: 'FeatureCollection', features: exploredFeatures });

      // Bright frontier = the most recently revealed band.
      const frontStart = Math.max(0, target - FRONTIER_BAND);
      const frontFeatures = [];
      for (let i = frontStart; i < target; i++) frontFeatures.push(lineFeature(segments[i]));
      map.getSource(FRONTIER)?.setData({ type: 'FeatureCollection', features: frontFeatures });

      if (t < 1) {
        searchRafRef.current = requestAnimationFrame(tick);
      } else {
        // Flash off the frontier, keep the explored web faintly, then signal done.
        map.getSource(FRONTIER)?.setData(emptyFC());
        searchRafRef.current = null;
        // Fade the explored web down so the route reads clearly on top.
        if (map.getLayer(L_EXPLORED)) map.setPaintProperty(L_EXPLORED, 'line-opacity', 0.32);
        if (map.getLayer(L_EXPLORED_GLOW)) map.setPaintProperty(L_EXPLORED_GLOW, 'line-opacity', 0.12);
        onSearchCompleteRef.current?.();
      }
    };

    searchRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (searchRafRef.current) {
        cancelAnimationFrame(searchRafRef.current);
        searchRafRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search?.runId, isLoaded]);

  // Clear the Dijkstra flood layers when the search is dismissed (search = null).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    if (search) return; // active search — leave layers in place

    if (searchRafRef.current) {
      cancelAnimationFrame(searchRafRef.current);
      searchRafRef.current = null;
    }
    lastRunIdRef.current = -1;
    const ids = [
      'dijkstra-explored-glow', 'dijkstra-explored-line',
      'dijkstra-frontier-line', 'dijkstra-endpoints-pts',
    ];
    ids.forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
    ['dijkstra-explored', 'dijkstra-frontier', 'dijkstra-endpoints'].forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, isLoaded]);

  // NOTE: The easeTo re-center effect has been intentionally removed.
  // Re-centering on every location update would snap the user's zoom level back
  // to the default (14) and interrupt manual panning — causing the "buggy zoom" issue.
  // The map is centered correctly at creation time. fitBounds handles the initial
  // two-pin view. After that the user has full control.

  return (
    <div className="map-container" style={{
      height, position: 'relative', borderRadius: '8px',
      overflow: 'hidden', border: '1px solid #2A2A2A', background: '#0A0A0A',
    }}>
      {!isLoaded && !hasError && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '12px', background: '#0A0A0A',
        }}>
          <div style={{
            width: 32, height: 32, border: '2px solid #2A2A2A',
            borderTopColor: '#EDEDED', borderRadius: '50%',
            animation: 'spin 0.85s linear infinite',
          }} />
          <span style={{ fontSize: '0.8rem', color: '#7A7A7A', letterSpacing: '0.06em', fontFamily: 'monospace' }}>
            Loading map...
          </span>
        </div>
      )}

      {hasError && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '8px', background: '#0A0A0A', color: '#7A7A7A', fontSize: '0.875rem',
        }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>Map failed to load
        </div>
      )}

      <div ref={containerRef} id={`livemap-${uid}`} style={{ width: '100%', height: '100%' }} />

      <style>{`
        #livemap-${uid} .maplibregl-ctrl-attrib {
          background: rgba(10,10,10,0.85) !important; color: #7A7A7A !important;
          font-size: 10px !important; border-radius: 4px !important; border: 1px solid #2A2A2A !important;
        }
        #livemap-${uid} .maplibregl-ctrl-attrib a { color: #B0B0B0 !important; }
        #livemap-${uid} .maplibregl-ctrl-group {
          background: #111111 !important; border: 1px solid #2A2A2A !important;
          border-radius: 6px !important; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.6) !important;
        }
        #livemap-${uid} .maplibregl-ctrl-group button {
          background: #111111 !important; border-bottom-color: #2A2A2A !important; color: #EDEDED;
        }
        #livemap-${uid} .maplibregl-ctrl-group button:hover { background: #1A1A1A !important; }
        #livemap-${uid} .maplibregl-ctrl-icon { filter: invert(1); opacity: 0.75; }
        #livemap-${uid} .maplibregl-popup-content {
          background: transparent !important; padding: 0 !important; box-shadow: none !important;
        }
        #livemap-${uid} .maplibregl-popup-tip { display: none !important; }
      `}</style>
    </div>
  );
}
