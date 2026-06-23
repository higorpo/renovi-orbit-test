import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import type { ServiceDetailLocationState } from "@/features/view-services";
import type { MobileStackLocationState } from "@/lib/navigation/mobileStack.types";

interface UseMobileBackNavigationOptions {
  backFallback?: string;
}

type MobileBackLocationState = MobileStackLocationState & ServiceDetailLocationState;

export function useMobileBackNavigation({ backFallback }: UseMobileBackNavigationOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as MobileBackLocationState | null;

  return useCallback(() => {
    if (locationState?.stackBackPath) {
      void navigate(locationState.stackBackPath);
      return;
    }

    if (locationState?.returnTo) {
      const backgroundState = locationState.background?.state;
      void navigate(
        locationState.returnTo,
        backgroundState != null ? { state: backgroundState } : undefined,
      );
      return;
    }

    if (backFallback) {
      void navigate(backFallback);
      return;
    }

    void navigate(-1);
  }, [
    backFallback,
    locationState?.background?.state,
    locationState?.returnTo,
    locationState?.stackBackPath,
    navigate,
  ]);
}
