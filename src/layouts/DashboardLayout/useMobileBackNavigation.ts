import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import type { MobileStackLocationState } from "@/lib/navigation/mobileStack.types";

interface UseMobileBackNavigationOptions {
  backFallback?: string;
}

export function useMobileBackNavigation({ backFallback }: UseMobileBackNavigationOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const stackState = location.state as MobileStackLocationState | null;

  return useCallback(() => {
    if (stackState?.stackBackPath) {
      void navigate(stackState.stackBackPath);
      return;
    }

    if (backFallback) {
      void navigate(backFallback);
      return;
    }

    void navigate(-1);
  }, [backFallback, navigate, stackState?.stackBackPath]);
}
