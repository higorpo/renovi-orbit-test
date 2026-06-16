import { MapPin } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { getServiceCardStyle } from "@/features/request-quote";
import { cn } from "@/lib/utils";
import { formatServiceDate } from "../utils/formatDate";
import { formatLocationDisplay } from "../utils/locationDisplay";
import { SimpleServiceInsightPanel } from "./SimpleServiceInsightPanel";
import type { ServiceModel } from "../types/service.types";

export interface SimpleServiceCardProps {
  model: ServiceModel;
  className?: string;
  /** Tighter layout for narrow containers (e.g. chat details sidebar). */
  compact?: boolean;
}

export function SimpleServiceCard({
  model,
  className,
  compact = false,
}: SimpleServiceCardProps) {
  const locationText = formatLocationDisplay(model.address);
  const serviceStyle = getServiceCardStyle(model.service ?? undefined);
  const createdLabel = formatServiceDate(model.createdAt);

  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader
        className={cn(
          compact ? "space-y-2 !p-3 !pb-3" : "space-y-3 !pb-3",
        )}
      >
        <div className={cn("flex min-w-0 items-start", compact ? "gap-2.5" : "gap-3")}>
          {model.service ? (
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                compact ? "h-8 w-8" : "h-10 w-10",
                serviceStyle.color,
              )}
              aria-hidden
            >
              <serviceStyle.Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            {model.service ? (
              <p
                className={cn(
                  "truncate font-medium text-muted-foreground",
                  compact ? "text-[11px]" : "text-xs",
                )}
              >
                {model.service.title}
              </p>
            ) : null}
            <h3
              className={cn(
                "font-semibold leading-snug text-foreground",
                compact ? "line-clamp-2 text-sm" : "text-base leading-tight sm:text-lg",
              )}
            >
              {model.title}
            </h3>
          </div>
        </div>

        {model.descriptionPreview ? (
          <p
            className={cn(
              "line-clamp-3 text-muted-foreground",
              compact ? "text-xs leading-relaxed" : "text-sm",
            )}
          >
            {model.descriptionPreview}
          </p>
        ) : null}

        <SimpleServiceInsightPanel model={model} compact={compact} />

        {compact ? (
          <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
            {locationText ? (
              <>
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{locationText}</span>
                <span aria-hidden className="shrink-0">
                  ·
                </span>
              </>
            ) : null}
            <span className="shrink-0">Solicitado em {createdLabel}</span>
          </div>
        ) : (
          <>
            {locationText ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{locationText}</span>
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">Solicitado em {createdLabel}</p>
          </>
        )}
      </CardHeader>
    </Card>
  );
}
