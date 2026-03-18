import { cn } from "@/lib/utils";
import { getServiceCardStyle } from "@/features/request-quote";
import type { ProviderPublicProfile } from "../types/providerProfilePublic.types";

export interface ProviderProfileServicesProps {
  profile: ProviderPublicProfile;
}

export function ProviderProfileServices({
  profile,
}: ProviderProfileServicesProps) {
  const services = profile.offered_services ?? [];
  if (services.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Serviços oferecidos</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {services.map((service) => {
          const { Icon, color } = getServiceCardStyle({
            icon_key: service.icon_key,
            color_key: service.color_key,
          });
          return (
            <div
              key={service.service_id}
              className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
                  color,
                )}
              >
                <Icon className="h-5 w-5 text-white" aria-hidden />
              </div>
              <span className="text-sm font-medium leading-tight">
                {service.title}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
