import { Clock, MapPin, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getServiceCardStyle } from "@/features/request-quote";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { getStatusBadgeVariant, getStatusLabel } from "../constants/statusBadge";
import type { ServiceModel } from "../types/service.types";
import { formatLocationDisplay } from "../utils/locationDisplay";
import { ServiceDetailAttributeCards } from "./ServiceDetailAttributeCards";
import { ServiceDetailActionsBar } from "./ServiceDetailActionsBar";

export interface ServiceDetailHeaderProps {
  model: ServiceModel;
  isClient: boolean;
  isProvider: boolean;
  onOpenBudgetSheet?: (model: ServiceModel) => void;
  onMutated?: () => void;
}

function formatSolicitadoLine(createdAt: string): string {
  const relative = formatRelativeDate(createdAt);
  if (relative === "Agora") return "Solicitado agora";
  if (relative.startsWith("Há ")) return `Solicitado há ${relative.slice(3)}`;
  return `Solicitado em ${relative}`;
}

export function ServiceDetailHeader({
  model,
  isClient,
  isProvider,
  onOpenBudgetSheet,
  onMutated,
}: ServiceDetailHeaderProps) {
  const serviceStyle = getServiceCardStyle(model.service ?? undefined);
  const locationLine = formatLocationDisplay(model.address);
  const solicitadoLine = formatSolicitadoLine(model.createdAt);
  const proposalLabel =
    model.proposalCount === 1
      ? "1 orçamento recebido"
      : `${model.proposalCount} orçamentos recebidos`;

  return (
    <div data-testid="service-detail-header">
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

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {model.service ? (
                  <p className="truncate text-caption text-muted-foreground">
                    {model.service.title}
                  </p>
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

            <div className="space-y-1.5 text-caption text-muted-foreground">
              {locationLine ? (
                <p className="flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 leading-5">{locationLine}</span>
                </p>
              ) : null}

              <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="leading-5">{solicitadoLine}</span>
                {isClient ? (
                  <>
                    <span aria-hidden className="leading-5 text-muted-foreground/60">
                      •
                    </span>
                    <span className="leading-5">{proposalLabel}</span>
                  </>
                ) : null}
              </p>

              {isProvider && model.counterpartyName ? (
                <p className="flex min-w-0 items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate leading-5">
                    Solicitante:{" "}
                    <span className="font-medium text-foreground">{model.counterpartyName}</span>
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <ServiceDetailAttributeCards model={model} showPendingInfo={isProvider} />

        <ServiceDetailActionsBar
          model={model}
          isClient={isClient}
          isProvider={isProvider}
          onOpenBudgetSheet={onOpenBudgetSheet}
          onMutated={onMutated}
        />
      </header>
    </div>
  );
}
