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

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 300_000,
};

export function useProviderLocation() {
  const [location, setLocation] = useState<ProviderLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation(DEFAULT_LOCATION);
      setError("Geolocalização não disponível neste navegador");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setError(null);
        setPermissionDenied(false);
        setIsLoading(false);
      },
      (err) => {
        setLocation(DEFAULT_LOCATION);
        setPermissionDenied(err.code === err.PERMISSION_DENIED);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Permissão de localização negada"
            : "Não foi possível obter sua localização",
        );
        setIsLoading(false);
      },
      GEO_OPTIONS,
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return {
    location,
    error,
    isLoading,
    permissionDenied,
    isUsingDefault: error != null && location != null,
    retry: requestLocation,
  };
}
