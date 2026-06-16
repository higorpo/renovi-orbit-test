import { Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getServiceCardStyle } from "@/features/request-quote";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { getStatusBadgeVariant, getStatusLabel } from "../constants/statusBadge";
import type { ServiceModel } from "../types/service.types";
import { formatLocationDisplay } from "../utils/locationDisplay";
import { SimpleServiceInsightPanel } from "./SimpleServiceInsightPanel";

interface ServiceDetailHeaderProps {
  model: ServiceModel;
  isClient: boolean;
  isProvider: boolean;
}

export function ServiceDetailHeader({ model, isClient, isProvider }: ServiceDetailHeaderProps) {
  const serviceStyle = getServiceCardStyle(model.service ?? undefined);
  const locationLine = formatLocationDisplay(model.address);

  return (
    <header className="space-y-4 p-4 sm:p-6">
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

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {model.service ? (
                <p className="truncate text-caption text-muted-foreground">{model.service.title}</p>
              ) : null}
              <h1 className="font-display text-title font-semibold leading-snug text-ink">
                {model.title}
              </h1>
            </div>
            <Badge
              variant={getStatusBadgeVariant(model.listPhase, model.proposalCount)}
              className="shrink-0 text-[11px] font-semibold"
            >
              {getStatusLabel(model.listPhase, model.hasPendingProposal)}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
            {locationLine ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{locationLine}</span>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Solicitado {formatRelativeDate(model.createdAt)}
            </span>
            {isClient ? (
              <span>
                {model.proposalCount}{" "}
                {model.proposalCount === 1 ? "orçamento recebido" : "orçamentos recebidos"}
              </span>
            ) : null}
          </div>

          {isProvider && model.counterpartyName ? (
            <p className="text-caption text-muted-foreground">
              Solicitante:{" "}
              <span className="font-medium text-foreground">{model.counterpartyName}</span>
            </p>
          ) : null}
        </div>
      </div>

      <SimpleServiceInsightPanel model={model} />
    </header>
  );
}
