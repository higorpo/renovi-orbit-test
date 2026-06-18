import { useAuth } from "@/features/auth";
import {
  captureOperationalLocationFix,
  getLatestProviderLocationSample,
  getOperationalLocationPermissionStatus,
  subscribeProviderLocationSamples,
} from "@/features/device-beacon";
import { Capacitor } from "@capacitor/core";
import { useState, useEffect, useCallback, useRef } from "react";

export interface ProviderLocation {
  latitude: number;
  longitude: number;
}

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

/**
 * Foreground feed GPS only (ADR 0002). Never fabricates coordinates for API calls.
 * Native Capacitor uses the geolocation plugin (not WebView); web/PWA uses browser APIs.
 */
export function useProviderLocation() {
  const { user } = useAuth();
  const profileId = user?.id ?? null;
  const isNativeApp = Capacitor.isNativePlatform();

  const [location, setLocation] = useState<ProviderLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [insecureContext, setInsecureContext] = useState(false);
  const hasRequestedRef = useRef(false);

  const applyFeedLocation = useCallback((latitude: number, longitude: number) => {
    setLocation({ latitude, longitude });
    setError(null);
    setPermissionDenied(false);
    setInsecureContext(false);
    setIsLoading(false);
  }, []);

  const clearFeedLocation = useCallback((message: string, denied: boolean) => {
    setLocation(null);
    setPermissionDenied(denied);
    setError(message);
    setIsLoading(false);
  }, []);

  const requestNativeLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setInsecureContext(false);

    const status = await getOperationalLocationPermissionStatus();

    if (status === "denied") {
      clearFeedLocation("Permissão de localização negada", true);
      return;
    }

    if (status === "unsupported") {
      clearFeedLocation("Geolocalização não disponível neste dispositivo", false);
      return;
    }

    const cached = profileId ? getLatestProviderLocationSample(profileId) : null;
    if (cached) {
      applyFeedLocation(cached.latitude, cached.longitude);
      return;
    }

    const fix = await captureOperationalLocationFix();
    if (fix?.granted && fix.latitude != null && fix.longitude != null) {
      applyFeedLocation(fix.latitude, fix.longitude);
      return;
    }

    if (fix?.status === "denied") {
      clearFeedLocation("Permissão de localização negada", true);
      return;
    }

    clearFeedLocation("Não foi possível obter sua localização", false);
  }, [applyFeedLocation, clearFeedLocation, profileId]);

  const requestWebLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setInsecureContext(false);
      clearFeedLocation("Geolocalização não disponível neste navegador", false);
      return;
    }

    if (isGeolocationInsecureContext()) {
      setInsecureContext(true);
      clearFeedLocation("Geolocalização requer HTTPS (exceto localhost)", false);
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
            applyFeedLocation(pos.coords.latitude, pos.coords.longitude);
          },
          (retryErr) => {
            const retryDenied = retryErr.code === GEO_ERR_PERMISSION_DENIED;
            clearFeedLocation(
              retryDenied
                ? "Permissão de localização negada"
                : "Não foi possível obter sua localização",
              retryDenied,
            );
          },
          GEO_OPTIONS_HIGH_ACCURACY,
        );
        return;
      }

      clearFeedLocation(
        denied
          ? "Permissão de localização negada"
          : "Não foi possível obter sua localização",
        denied,
      );
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyFeedLocation(pos.coords.latitude, pos.coords.longitude);
      },
      finishWithError,
      GEO_OPTIONS,
    );
  }, [applyFeedLocation, clearFeedLocation]);

  const requestLocation = useCallback(() => {
    if (isNativeApp) {
      void requestNativeLocation();
      return;
    }
    requestWebLocation();
  }, [isNativeApp, requestNativeLocation, requestWebLocation]);

  useEffect(() => {
    if (hasRequestedRef.current) {
      return;
    }
    hasRequestedRef.current = true;
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (!isNativeApp || !profileId || location) {
      return;
    }

    const cached = getLatestProviderLocationSample(profileId);
    if (cached) {
      applyFeedLocation(cached.latitude, cached.longitude);
    }
  }, [applyFeedLocation, isNativeApp, location, profileId]);

  useEffect(() => {
    if (!isNativeApp || !profileId) {
      return;
    }

    return subscribeProviderLocationSamples((id, sample) => {
      if (id === profileId) {
        applyFeedLocation(sample.latitude, sample.longitude);
      }
    });
  }, [applyFeedLocation, isNativeApp, profileId]);

  useEffect(() => {
    if (isNativeApp || typeof navigator === "undefined" || !navigator.permissions?.query) {
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
            requestWebLocation();
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
  }, [isNativeApp, requestWebLocation]);

  const hasFeedLocation = location != null;

  return {
    location,
    error,
    isLoading,
    permissionDenied,
    insecureContext,
    hasFeedLocation,
    isUsingDefault: !hasFeedLocation,
    isNativeApp,
    retry: requestLocation,
  };
}
