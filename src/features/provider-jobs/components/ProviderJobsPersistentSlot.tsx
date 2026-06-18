import { useLocation } from "react-router";
import { useServiceDetailModal } from "@/features/view-services";
import { ProviderJobsPage } from "./ProviderJobsPage";

/**
 * Keeps the jobs list mounted when opening service detail as a sheet from Trabalhos.
 * Avoids remounting ProviderJobsPage (and re-fetching the provider jobs feed) on route change.
 */
export function ProviderJobsPersistentSlot() {
  const location = useLocation();
  const modal = useServiceDetailModal();
  const visible =
    location.pathname === "/dashboard/jobs" ||
    (modal.isFromProviderJobs && modal.background?.pathname === "/dashboard/jobs");

  if (!visible) {
    return null;
  }

  return <ProviderJobsPage />;
}
