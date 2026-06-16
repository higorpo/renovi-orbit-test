import { useLocation } from "react-router";
import { useServiceDetailModal } from "@/features/view-services";
import { ProviderMyServicesPage } from "./ProviderMyServicesPage";

/**
 * Keeps the provider my-services list mounted when opening service detail as a sheet.
 * Avoids remounting ProviderMyServicesPage (and re-fetching list_services) on route change.
 */
export function ProviderMyServicesPersistentSlot() {
  const location = useLocation();
  const modal = useServiceDetailModal();
  const visible =
    location.pathname === "/dashboard/services" ||
    (modal.isFromProviderMyServices &&
      modal.background?.pathname === "/dashboard/services");

  if (!visible) {
    return null;
  }

  return <ProviderMyServicesPage />;
}
