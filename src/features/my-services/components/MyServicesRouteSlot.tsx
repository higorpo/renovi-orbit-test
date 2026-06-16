import { useAuth } from "@/features/auth";
import { ClientMyServicesPage } from "./client/ClientMyServicesPage";

/** Renders client list only; provider list lives in ProviderMyServicesPersistentSlot. */
export function MyServicesRouteSlot() {
  const { profile } = useAuth();
  if (profile?.role === "provider") {
    return null;
  }
  return <ClientMyServicesPage />;
}
