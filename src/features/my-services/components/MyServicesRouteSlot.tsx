import { useAuth } from "@/features/auth";
import { ClientMyServicesPage } from "./client/ClientMyServicesPage";
import { ProviderMyServicesPage } from "./provider/ProviderMyServicesPage";

export function MyServicesRouteSlot() {
  const { profile } = useAuth();
  if (profile?.role === "provider") {
    return <ProviderMyServicesPage />;
  }
  return <ClientMyServicesPage />;
}
