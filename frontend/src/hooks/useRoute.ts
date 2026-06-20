'use client';

import { useEffect, useRef, useState } from 'react';
import { getRoute, haversineKm, RouteResult } from '@/lib/routing';

type LatLng = { lat: number; lng: number } | null;

/**
 * Fetches and maintains a driving route between two live points
 * (e.g. ambulance → patient).
 *
 * - Refetches only when either endpoint moves more than `minMoveMeters`,
 *   so a jittery GPS feed doesn't hammer the public OSRM server.
 * - Returns the route geometry ([lng, lat][]) plus road distance / duration.
 * - Cleans up in-flight requests on unmount or input change.
 */
export function useRoute(
  from: LatLng,
  to: LatLng,
  minMoveMeters = 40
): { route: RouteResult | null; isLoading: boolean } {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Last coordinates we actually routed from/to.
  const lastFromRef = useRef<LatLng>(null);
  const lastToRef = useRef<LatLng>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!from || !to) {
      setRoute(null);
      return;
    }

    const movedEnough = (prev: LatLng, next: { lat: number; lng: number }) => {
      if (!prev) return true;
      return haversineKm(prev.lat, prev.lng, next.lat, next.lng) * 1000 >= minMoveMeters;
    };

    // Skip refetch if neither endpoint moved meaningfully.
    if (!movedEnough(lastFromRef.current, from) && !movedEnough(lastToRef.current, to)) {
      return;
    }

    lastFromRef.current = from;
    lastToRef.current = to;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    getRoute([from.lat, from.lng], [to.lat, to.lng], controller.signal)
      .then((r) => {
        if (!controller.signal.aborted) setRoute(r);
      })
      .catch(() => {
        /* getRoute already falls back internally; ignore aborts */
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [from?.lat, from?.lng, to?.lat, to?.lng, minMoveMeters]);

  return { route, isLoading };
}
