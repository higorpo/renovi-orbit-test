import { MapPin, Briefcase, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProviderAreaSummary } from "../types/provider-jobs.types";

export interface JobsHeaderProps {
  totalCount: number;
  isLoading: boolean;
  isUsingDefaultLocation: boolean;
  providerAreaSummary: ProviderAreaSummary;
}

export function JobsHeader({
  totalCount,
  isLoading,
  isUsingDefaultLocation,
  providerAreaSummary,
}: JobsHeaderProps) {
  const areaSummaryText = providerAreaSummary.cities.length > 0
    ? providerAreaSummary.cities.join(", ")
    : null;

  const neighborhoodPreview = providerAreaSummary.neighborhoods.length > 0
    ? providerAreaSummary.neighborhoods.slice(0, 3).join(", ") +
      (providerAreaSummary.neighborhoods.length > 3
        ? ` +${providerAreaSummary.neighborhoods.length - 3}`
        : "")
    : null;

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Trabalhos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Pedidos compatíveis com sua atuação e sua região
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:text-sm">
        {areaSummaryText && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Área: {areaSummaryText}</span>
          </span>
        )}

        {neighborhoodPreview && (
          <span className="flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{neighborhoodPreview}</span>
          </span>
        )}

        {isUsingDefaultLocation && (
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Localização aproximada</span>
          </span>
        )}

        {!isLoading && (
          <span
            className={cn(
              "flex items-center gap-1.5 font-medium",
              totalCount > 0
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {totalCount} trabalho{totalCount !== 1 ? "s" : ""} encontrado
              {totalCount !== 1 ? "s" : ""}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
