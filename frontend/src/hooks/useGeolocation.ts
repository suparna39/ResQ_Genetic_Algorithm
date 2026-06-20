'use client';

import { useState, useEffect, useCallback } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  isLoading: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean; // continuously watch position
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 5000,
    watch = false,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    isLoading: false,
  });

  const [watchId, setWatchId] = useState<number | null>(null);

  const onSuccess = useCallback((position: GeolocationPosition) => {
    setState({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      error: null,
      isLoading: false,
    });
  }, []);

  const onError = useCallback((err: GeolocationPositionError) => {
    setState((prev) => ({
      ...prev,
      error: err.message,
      isLoading: false,
    }));
  }, []);

  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: 'Geolocation is not supported by your browser',
        isLoading: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy,
      timeout,
      maximumAge,
    });
  }, [enableHighAccuracy, timeout, maximumAge, onSuccess, onError]);

  // Start continuous watch
  const startWatch = useCallback(() => {
    if (!navigator.geolocation || watchId !== null) return;
    setState((prev) => ({ ...prev, isLoading: true }));
    const id = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy,
      timeout,
      maximumAge,
    });
    setWatchId(id);
  }, [enableHighAccuracy, timeout, maximumAge, onSuccess, onError, watchId]);

  const stopWatch = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  // Auto-watch if requested
  useEffect(() => {
    if (watch) {
      startWatch();
    } else {
      getPosition();
    }
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    getPosition,
    startWatch,
    stopWatch,
    isWatching: watchId !== null,
  };
}
