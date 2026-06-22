export type MobileChromeMode = "tab-root" | "stack" | "custom" | "hidden";

export interface MobileChromeConfig {
  mode: MobileChromeMode;
  showTabHeader: boolean;
  showStackHeader: boolean;
  showBottomNav: boolean;
  enableStackTransition: boolean;
  mainOverflowHidden: boolean;
  mainPaddingBottom: boolean;
  stackTitle?: string;
  backFallback?: string;
}

export const MOBILE_TAB_ROOT_DEFAULT: MobileChromeConfig = {
  mode: "tab-root",
  showTabHeader: true,
  showStackHeader: false,
  showBottomNav: true,
  enableStackTransition: false,
  mainOverflowHidden: false,
  mainPaddingBottom: true,
};
