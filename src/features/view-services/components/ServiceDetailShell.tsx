import { useLocation } from "react-router";
import type { ServiceDetailLocationState } from "../types/serviceDetailNavigation.types";
import { ServiceDetailPage } from "./ServiceDetailPage";

export function ServiceDetailShell() {
  const location = useLocation();
  const state = location.state as ServiceDetailLocationState | null;
  const openAsSheet =
    state?.serviceDetailPresentation === "sheet" && state.background != null;

  if (openAsSheet) {
    return null;
  }

  return <ServiceDetailPage />;
}
