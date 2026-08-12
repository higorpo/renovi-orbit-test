import type { Location } from "react-router";
import type { ServiceDetailLocationState } from "@/features/view-services/types/serviceDetailNavigation.types";
import {
  SETTINGS_SECTION_STACK_TITLE,
  type SettingsSectionSlug,
} from "@/features/settings/constants/settingsNav";
import { ROUTE_SETTINGS } from "@/features/settings/constants/routes";
import type { MobileChromeConfig } from "./mobileNavigation.types";
import { MOBILE_TAB_ROOT_DEFAULT } from "./mobileNavigation.types";

function isServiceDetailSheetLocation(location: Location): boolean {
  const state = location.state as ServiceDetailLocationState | null;

  return (
    /^\/dashboard\/services\/[^/]+$/.test(location.pathname) &&
    state?.serviceDetailPresentation === "sheet" &&
    state.background != null
  );
}

interface StackRouteRule {
  pattern: RegExp;
  stackTitle: string;
  backFallback: string;
}

const MOBILE_STACK_ROUTES: StackRouteRule[] = [
  {
    pattern: /^\/dashboard\/services\/calendar$/,
    stackTitle: "Calendário",
    backFallback: "/dashboard/services",
  },
  { pattern: /^\/dashboard\/help$/, stackTitle: "Ajuda", backFallback: "/dashboard" },
];

function createStackConfig(stackTitle: string, backFallback: string): MobileChromeConfig {
  return {
    mode: "stack",
    showTabHeader: false,
    showStackHeader: true,
    showBottomNav: false,
    enableStackTransition: true,
    mainOverflowHidden: false,
    mainPaddingBottom: false,
    stackTitle,
    backFallback,
  };
}

function resolveSettingsSectionChrome(pathname: string): MobileChromeConfig | null {
  const match = pathname.match(/^\/dashboard\/settings\/([^/]+)$/);
  if (!match) return null;
  const slug = match[1] as SettingsSectionSlug;
  const stackTitle = SETTINGS_SECTION_STACK_TITLE[slug] ?? "Configurações";
  return createStackConfig(stackTitle, ROUTE_SETTINGS);
}

export function resolveMobileChrome(
  pathname: string,
  location: Location,
): MobileChromeConfig {
  const chatConversationMatch = pathname.match(/^\/dashboard\/chats\/([^/]+)$/);
  if (chatConversationMatch) {
    return {
      mode: "custom",
      showTabHeader: false,
      showStackHeader: false,
      showBottomNav: false,
      enableStackTransition: false,
      mainOverflowHidden: true,
      mainPaddingBottom: false,
    };
  }

  const serviceDetailMatch = pathname.match(/^\/dashboard\/services\/([^/]+)$/);
  if (serviceDetailMatch) {
    if (serviceDetailMatch[1] === "calendar") {
      return createStackConfig("Calendário", "/dashboard/services");
    }

    if (isServiceDetailSheetLocation(location)) {
      return MOBILE_TAB_ROOT_DEFAULT;
    }

    return createStackConfig("Detalhes do serviço", "/dashboard/services");
  }

  const settingsSectionChrome = resolveSettingsSectionChrome(pathname);
  if (settingsSectionChrome) {
    return settingsSectionChrome;
  }

  for (const route of MOBILE_STACK_ROUTES) {
    if (route.pattern.test(pathname)) {
      return createStackConfig(route.stackTitle, route.backFallback);
    }
  }

  if (pathname.startsWith("/dashboard")) {
    return MOBILE_TAB_ROOT_DEFAULT;
  }

  return {
    mode: "hidden",
    showTabHeader: false,
    showStackHeader: false,
    showBottomNav: false,
    enableStackTransition: false,
    mainOverflowHidden: false,
    mainPaddingBottom: false,
  };
}
