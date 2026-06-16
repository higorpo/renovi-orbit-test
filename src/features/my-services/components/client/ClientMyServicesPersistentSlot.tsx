import { useLocation } from "react-router";
import { useAuth } from "@/features/auth";
import { useServiceDetailModal } from "@/features/view-services";
import { ClientMyServicesPage } from "./ClientMyServicesPage";

/**
 * Keeps the client my-services list mounted when opening service detail as a sheet.
 */
export function ClientMyServicesPersistentSlot() {
  const { profile } = useAuth();
  const location = useLocation();
  const modal = useServiceDetailModal();

  if (profile?.role !== "client") {
    return null;
  }

  const visible =
    location.pathname === "/dashboard/services" ||
    (modal.isFromClientMyServices &&
      modal.background?.pathname === "/dashboard/services");

  if (!visible) {
    return null;
  }

  return <ClientMyServicesPage />;
}
