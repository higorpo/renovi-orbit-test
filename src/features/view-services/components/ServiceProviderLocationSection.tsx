import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocationPreviewMap } from "@/features/addresses";
import { openGoogleMaps } from "@/lib/maps/openGoogleMaps";
import type { AddressSummary } from "../types/service.types";
import { formatLocationDisplay } from "../utils/locationDisplay";
import { getServiceCoordinates } from "../utils/serviceLocation";
import { ServiceDetailSection } from "./ServiceDetailSection";

interface ServiceProviderLocationSectionProps {
  address: AddressSummary | null;
}

export function ServiceProviderLocationSection({
  address,
}: ServiceProviderLocationSectionProps) {
  const locationLine = formatLocationDisplay(address);
  const coordinates = getServiceCoordinates(address);
  const canOpenMap = coordinates !== null;

  if (!locationLine && !coordinates) {
    return null;
  }

  return (
    <ServiceDetailSection title="Local do serviço">
      <div className="space-y-3">
        {locationLine ? (
          <p className="flex items-start gap-2 text-caption text-body">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>{locationLine}</span>
          </p>
        ) : null}

        {coordinates ? (
          <LocationPreviewMap
            location={coordinates}
            className="w-full border border-border"
            height={220}
          />
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 min-h-10 w-full gap-1.5 rounded-full sm:w-auto"
          disabled={!canOpenMap}
          onClick={() => {
            if (!coordinates) return;
            openGoogleMaps(coordinates);
          }}
        >
          <Navigation className="h-4 w-4 shrink-0" aria-hidden />
          Abrir no mapa
        </Button>
      </div>
    </ServiceDetailSection>
  );
}
