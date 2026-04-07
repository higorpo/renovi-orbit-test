import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProviderPublicProfile } from "../types/providerProfilePublic.types";

export interface ProviderProfileServiceAreaProps {
  profile: ProviderPublicProfile;
}

export function ProviderProfileServiceArea({
  profile,
}: ProviderProfileServiceAreaProps) {
  const cities = profile.service_area_cities?.filter(Boolean) ?? [];
  const neighborhoods =
    profile.service_area_neighborhoods?.filter(Boolean) ?? [];
  if (cities.length === 0 && neighborhoods.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Área de atuação</h2>
      <div className="space-y-3">
        {cities.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            <span>{cities.join(", ")}</span>
          </div>
        )}
        {neighborhoods.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {neighborhoods.map((n, index) => (
              <Badge
                key={`${n}-${index}`}
                variant="outline"
                className="font-normal"
              >
                {n}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
