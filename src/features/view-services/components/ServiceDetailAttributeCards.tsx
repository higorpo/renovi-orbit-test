import type { ComponentType } from "react";
import { AlertTriangle, Clock3, Crosshair, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getComplexityLabel,
  getDurationLabel,
  getUrgencyConfig,
} from "../constants/serviceDetail.constants";
import type { ServiceModel } from "../types/service.types";

export interface ServiceDetailAttributeCardsProps {
  model: ServiceModel;
  /** Pending-info alert is provider-only. */
  showPendingInfo?: boolean;
  className?: string;
}

function priorityShortLabel(urgency: string | null | undefined): string | null {
  const config = getUrgencyConfig(urgency);
  if (!config) return null;
  if (urgency === "high") return "Alta";
  if (urgency === "medium") return "Média";
  if (urgency === "low") return "Baixa";
  return config.label;
}

function AttributeCard({
  icon: Icon,
  label,
  value,
  accent = "neutral",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: "neutral" | "priority";
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
          accent === "priority"
            ? "border-orange-300 text-orange-600 dark:border-orange-500/50 dark:text-orange-400"
            : "border-border text-muted-foreground",
        )}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium leading-none text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold leading-snug text-foreground">{value}</p>
      </div>
    </div>
  );
}

/**
 * Detail-only attribute strip (priority / duration / scope) + pending-info alert.
 * List cards keep using `SimpleServiceInsightPanel`.
 */
export function ServiceDetailAttributeCards({
  model,
  showPendingInfo = false,
  className,
}: ServiceDetailAttributeCardsProps) {
  const priority = priorityShortLabel(model.urgency);
  const duration = getDurationLabel(model.estimatedDurationHint);
  const scope = model.scopeComplexity ? getComplexityLabel(model.scopeComplexity) : null;
  const warnings = showPendingInfo
    ? (model.missingInfoWarnings ?? []).map((w) => w.trim()).filter(Boolean)
    : [];

  const cards = [
    priority
      ? {
          key: "priority",
          icon: Crosshair,
          label: "Prioridade",
          value: priority,
          accent: "neutral" as const,
        }
      : null,
    duration
      ? {
          key: "duration",
          icon: Clock3,
          label: "Duração estimada",
          value: duration,
          accent: "neutral" as const,
        }
      : null,
    scope
      ? {
          key: "scope",
          icon: Wrench,
          label: "Escopo",
          value: scope,
          accent: "neutral" as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: string;
    accent: "neutral" | "priority";
  }>;

  if (cards.length === 0 && warnings.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)} data-testid="service-detail-attribute-cards">
      {cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map((card) => (
            <AttributeCard
              key={card.key}
              icon={card.icon}
              label={card.label}
              value={card.value}
              accent={card.accent}
            />
          ))}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div
          className="rounded-lg border border-orange-200 bg-orange-50 px-3.5 py-3 dark:border-orange-500/30 dark:bg-orange-500/10"
          data-testid="service-detail-pending-info"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400"
              aria-hidden
            />
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm font-semibold leading-none text-orange-900 dark:text-orange-100">
                Informações pendentes
              </p>
              <ul className="list-disc space-y-1 pl-4 text-sm leading-snug text-orange-900/90 dark:text-orange-100/90">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ServiceDetailAttributeCardsSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("space-y-3", className)}
      aria-hidden
      data-testid="service-detail-attribute-cards-skeleton"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
          >
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
              <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
