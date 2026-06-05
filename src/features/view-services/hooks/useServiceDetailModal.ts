import { useLocation, useMatch } from "react-router";
import type { ServiceDetailLocationState } from "../types/serviceDetailNavigation.types";

export function useServiceDetailModal() {
  const location = useLocation();
  const state = location.state as ServiceDetailLocationState | null;
  const match = useMatch({ path: "/dashboard/services/:id", end: true });

  const isOpen =
    match != null &&
    state?.serviceDetailPresentation === "sheet" &&
    state.background != null;

  return {
    isOpen,
    isFromProviderJobs: isOpen && state?.returnTo === "/dashboard/jobs",
    isFromProviderBudgets: isOpen && state?.returnTo === "/dashboard/budgets",
    serviceRequestId: match?.params.id,
    background: state?.background ?? null,
  };
}
