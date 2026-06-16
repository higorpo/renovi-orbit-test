import type { ReactNode } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getComplexityLabel,
  getDurationLabel,
  getUrgencyConfig,
} from "../constants/serviceDetail.constants";
import type { ServiceModel } from "../types/service.types";

interface SimpleServiceInsightPanelProps {
  model: ServiceModel;
  compact?: boolean;
  className?: string;
}

interface InsightSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: ReactNode;
  compact?: boolean;
  tone?: "default" | "warning";
}

function InsightSection({
  title,
  icon: Icon,
  children,
  compact,
  tone = "default",
}: InsightSectionProps) {
  return (
    <div
      className={cn(
        "space-y-1.5",
        tone === "warning" && "rounded-md bg-amber-500/10 px-2 py-1.5",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon
          className={cn(
            "shrink-0",
            compact ? "h-3 w-3" : "h-3.5 w-3.5",
            tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
          )}
          aria-hidden
        />
        <p
          className={cn(
            "font-semibold uppercase tracking-wide",
            compact ? "text-[10px]" : "text-[11px]",
            tone === "warning"
              ? "text-amber-800 dark:text-amber-200"
              : "text-muted-foreground",
          )}
        >
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

function LabeledInsightRow({
  label,
  children,
  compact,
}: {
  label: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 items-center justify-between gap-2", compact ? "text-xs" : "text-sm")}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function insightBadgeClass(compact?: boolean) {
  return cn(
    "font-normal",
    compact ? "h-5 px-1.5 text-[10px]" : "text-xs",
  );
}

export function SimpleServiceInsightPanel({
  model,
  compact,
  className,
}: SimpleServiceInsightPanelProps) {
  const urgency = getUrgencyConfig(model.urgency);
  const scopeLabel = model.scopeComplexity ? getComplexityLabel(model.scopeComplexity) : null;
  const durationLabel = getDurationLabel(model.estimatedDurationHint);
  const warnings = (model.missingInfoWarnings ?? []).map((w) => w.trim()).filter(Boolean);

  const hasScheduling = Boolean(urgency || scopeLabel || durationLabel);
  const hasWarnings = warnings.length > 0;

  if (!hasScheduling && !hasWarnings) return null;

  const sections: ReactNode[] = [];

  if (hasScheduling) {
    sections.push(
      <InsightSection key="scheduling" title="Resumo do pedido" icon={Clock} compact={compact}>
        <div className="space-y-1">
          {urgency ? (
            <LabeledInsightRow label="Prioridade" compact={compact}>
              <Badge variant={urgency.variant} className={insightBadgeClass(compact)}>
                {urgency.label}
              </Badge>
            </LabeledInsightRow>
          ) : null}
          {scopeLabel ? (
            <LabeledInsightRow label="Escopo" compact={compact}>
              <Badge variant="secondary" className={insightBadgeClass(compact)}>
                {scopeLabel}
              </Badge>
            </LabeledInsightRow>
          ) : null}
          {durationLabel ? (
            <LabeledInsightRow label="Duração estimada" compact={compact}>
              <Badge variant="secondary" className={insightBadgeClass(compact)}>
                {durationLabel}
              </Badge>
            </LabeledInsightRow>
          ) : null}
        </div>
      </InsightSection>,
    );
  }

  if (hasWarnings) {
    sections.push(
      <InsightSection
        key="warnings"
        title="Informações pendentes"
        icon={AlertTriangle}
        compact={compact}
        tone="warning"
      >
        <ul className={cn("space-y-1", compact ? "text-[11px]" : "text-xs")}>
          {warnings.map((warning) => (
            <li key={warning} className="leading-snug text-amber-900 dark:text-amber-100">
              {warning}
            </li>
          ))}
        </ul>
      </InsightSection>,
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-muted/20",
        compact ? "px-2 py-2" : "px-3 py-2.5",
        className,
      )}
    >
      {sections.map((section, index) => (
        <div
          key={index}
          className={cn(index > 0 && "mt-2.5 border-t border-border/50 pt-2.5")}
        >
          {section}
        </div>
      ))}
    </div>
  );
}
