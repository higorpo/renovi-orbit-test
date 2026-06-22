import { useLocation, useMatch } from "react-router";
import type { ServiceDetailLocationState } from "../types/serviceDetailNavigation.types";
import { isServiceDetailSheetLocation } from "../utils/isServiceDetailSheetLocation";

export function useServiceDetailModal() {
  const location = useLocation();
  const match = useMatch({ path: "/dashboard/services/:id", end: true });
  const isOpen = match != null && isServiceDetailSheetLocation(location);
  const state = (isOpen ? location.state : null) as ServiceDetailLocationState | null;

  return {
    isOpen,
    isFromProviderJobs: isOpen && state?.returnTo === "/dashboard/jobs",
    isFromProviderMyServices:
      isOpen &&
      state?.returnTo === "/dashboard/services" &&
      state?.myServicesRole === "provider",
    isFromClientMyServices:
      isOpen &&
      state?.returnTo === "/dashboard/services" &&
      state?.myServicesRole === "client",
    serviceRequestId: match?.params.id,
    background: state?.background ?? null,
  };
}
