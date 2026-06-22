import type { Location } from "react-router";
import type { ServiceDetailLocationState } from "../types/serviceDetailNavigation.types";

export function isServiceDetailSheetLocation(location: Location): boolean {
  const state = location.state as ServiceDetailLocationState | null;

  return (
    /^\/dashboard\/services\/[^/]+$/.test(location.pathname) &&
    state?.serviceDetailPresentation === "sheet" &&
    state.background != null
  );
}
