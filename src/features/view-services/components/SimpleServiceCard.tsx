import { MapPin } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getServiceCardStyle } from "@/features/request-quote";
import { cn } from "@/lib/utils";
import { getStatusBadgeVariant, getStatusLabel } from "../constants/statusBadge";
import { formatLocationDisplay } from "../utils/locationDisplay";
import { formatServiceDate } from "../utils/formatDate";
import { ServiceInsightTags } from "./ServiceInsightTags";
import type { ServiceModel } from "../types/service.types";

const DESCRIPTION_CLAMP = "line-clamp-2";

export interface SimpleServiceCardProps {
  model: ServiceModel;
  className?: string;
}

export function SimpleServiceCard({ model, className }: SimpleServiceCardProps) {
  const locationText = formatLocationDisplay(model.address);
  const serviceStyle = getServiceCardStyle(model.service ?? undefined);
  const statusVariant = getStatusBadgeVariant(model.listPhase, model.proposalCount);

  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader className="space-y-3 !pb-3">
        <div className="flex min-w-0 items-start gap-3">
          {model.service ? (
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
                serviceStyle.color,
              )}
              aria-hidden
            >
              <serviceStyle.Icon className="h-5 w-5" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            {model.service ? (
              <p className="text-xs font-medium text-muted-foreground">{model.service.title}</p>
            ) : null}
            <h3 className="text-base font-semibold leading-tight sm:text-lg">{model.title}</h3>
          </div>
          <Badge variant={statusVariant} className="shrink-0">
            {getStatusLabel(model.listPhase, model.hasPendingProposal)}
          </Badge>
        </div>

        {model.descriptionPreview ? (
          <p className={cn("text-sm text-muted-foreground", DESCRIPTION_CLAMP)}>
            {model.descriptionPreview}
          </p>
        ) : null}

        <ServiceInsightTags model={model} />

        {locationText ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{locationText}</span>
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Criado em {formatServiceDate(model.createdAt)}
        </p>
      </CardHeader>
    </Card>
  );
}
