import { useState, useEffect, useCallback } from "react";

export interface ProviderLocation {
  latitude: number;
  longitude: number;
}

// Default: Florianópolis center (same fallback used by the addresses feature)
const DEFAULT_LOCATION: ProviderLocation = {
  latitude: -27.5969,
  longitude: -48.5495,
};

/** GeolocationPositionError codes (use numeric values for older WebViews). */
const GEO_ERR_PERMISSION_DENIED = 1;
const GEO_ERR_POSITION_UNAVAILABLE = 2;
const GEO_ERR_TIMEOUT = 3;

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20_000,
  maximumAge: 300_000,
};

const GEO_OPTIONS_HIGH_ACCURACY: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 25_000,
  maximumAge: 0,
};

function isLocalDevHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

function isGeolocationInsecureContext(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return false;
  return !isLocalDevHostname(window.location.hostname);
}

export function useProviderLocation() {
  const [location, setLocation] = useState<ProviderLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [insecureContext, setInsecureContext] = useState(false);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation(DEFAULT_LOCATION);
      setError("Geolocalização não disponível neste navegador");
      setPermissionDenied(false);
      setInsecureContext(false);
      setIsLoading(false);
      return;
    }

    if (isGeolocationInsecureContext()) {
      setLocation(DEFAULT_LOCATION);
      setError("Geolocalização requer HTTPS (exceto localhost)");
      setPermissionDenied(false);
      setInsecureContext(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setInsecureContext(false);

    const finishWithError = (err: GeolocationPositionError) => {
      const denied = err.code === GEO_ERR_PERMISSION_DENIED;

      if (err.code === GEO_ERR_TIMEOUT || err.code === GEO_ERR_POSITION_UNAVAILABLE) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
            setError(null);
            setPermissionDenied(false);
            setInsecureContext(false);
            setIsLoading(false);
          },
          (retryErr) => {
            const retryDenied = retryErr.code === GEO_ERR_PERMISSION_DENIED;
            setLocation(DEFAULT_LOCATION);
            setPermissionDenied(retryDenied);
            setError(
              retryDenied
                ? "Permissão de localização negada"
                : "Não foi possível obter sua localização",
            );
            setIsLoading(false);
          },
          GEO_OPTIONS_HIGH_ACCURACY,
        );
        return;
      }

      setLocation(DEFAULT_LOCATION);
      setPermissionDenied(denied);
      setError(
        denied
          ? "Permissão de localização negada"
          : "Não foi possível obter sua localização",
      );
      setIsLoading(false);
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setError(null);
        setPermissionDenied(false);
        setInsecureContext(false);
        setIsLoading(false);
      },
      finishWithError,
      GEO_OPTIONS,
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // When the user fixes permission in the browser (not only OS), retry automatically.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return;
    }

    let disposed = false;
    let statusObj: PermissionStatus | null = null;
    let onGranted: (() => void) | null = null;

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (disposed) return;
        statusObj = status;
        onGranted = () => {
          if (status.state === "granted") {
            requestLocation();
          }
        };
        status.addEventListener("change", onGranted);
      })
      .catch(() => {});

    return () => {
      disposed = true;
      if (statusObj && onGranted) {
        statusObj.removeEventListener("change", onGranted);
      }
    };
  }, [requestLocation]);

  return {
    location,
    error,
    isLoading,
    permissionDenied,
    insecureContext,
    isUsingDefault: error != null && location != null,
    retry: requestLocation,
  };
}
