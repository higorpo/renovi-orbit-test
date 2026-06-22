import { useMemo } from "react";
import { useLocation } from "react-router";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { resolveMobileChrome } from "./mobileNavigation.config";
import type { MobileChromeConfig } from "./mobileNavigation.types";
import { MOBILE_TAB_ROOT_DEFAULT } from "./mobileNavigation.types";

const DESKTOP_CHROME: MobileChromeConfig = {
  mode: "hidden",
  showTabHeader: false,
  showStackHeader: false,
  showBottomNav: false,
  enableStackTransition: false,
  mainOverflowHidden: false,
  mainPaddingBottom: false,
};

export function useMobileNavigationChrome(): MobileChromeConfig {
  const isDesktop = useBreakpointMd();
  const location = useLocation();

  return useMemo(() => {
    if (isDesktop) {
      return DESKTOP_CHROME;
    }

    return resolveMobileChrome(location.pathname, location);
  }, [isDesktop, location]);
}

export function useIsMobileTabRoot(): boolean {
  const chrome = useMobileNavigationChrome();
  return chrome.mode === "tab-root";
}

export { MOBILE_TAB_ROOT_DEFAULT };
