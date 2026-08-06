/**
 * Intro step for the pending-evaluation prompt (before evidence review).
 * Keeps the lightweight RPC summary — full completion context loads after Continuar.
 */

import { Button } from "@/components/ui/button";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";
import { formatCalendarDate } from "@/lib/utils/calendarDate";
import { formatDatePtBr } from "@/lib/utils/formatDate";
import { ChevronRight, Star } from "lucide-react";
import type { PendingEvaluationPromptSummary } from "../api/pendingEvaluationPrompt.api";

export type PendingEvaluationIntroStepProps = {
  summary: PendingEvaluationPromptSummary;
  onContinue: () => void;
  className?: string;
};

function formatExecutedLabel(executedAt: string): string | null {
  if (!executedAt) return null;
  return formatDatePtBr(executedAt);
}

function formatScheduledLabel(scheduledStartDate: string | null): string | null {
  if (!scheduledStartDate) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(scheduledStartDate)) {
    return formatCalendarDate(scheduledStartDate);
  }
  return formatDatePtBr(scheduledStartDate);
}

export function PendingEvaluationIntroStep({
  summary,
  onContinue,
  className,
}: PendingEvaluationIntroStepProps) {
  const isDesktop = useBreakpointMd();
  const executedLabel = formatExecutedLabel(summary.executedAt);
  const scheduledLabel = formatScheduledLabel(summary.scheduledStartDate);

  const body = (
    <div
      className="space-y-4"
      data-testid="pending-evaluation-intro"
    >
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Star className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            {summary.title}
          </p>
          {summary.categoryTitle ? (
            <p className="text-xs text-muted-foreground">{summary.categoryTitle}</p>
          ) : null}
          {summary.providerFullName ? (
            <p className="text-sm text-muted-foreground">
              Prestador:{" "}
              <span className="font-medium text-foreground">
                {summary.providerFullName}
              </span>
            </p>
          ) : null}
          {executedLabel ? (
            <p className="text-sm text-muted-foreground">
              Executado em{" "}
              <span className="font-medium text-foreground">{executedLabel}</span>
            </p>
          ) : null}
          {scheduledLabel ? (
            <p className="text-sm text-muted-foreground">
              Agenda:{" "}
              <span className="font-medium text-foreground">{scheduledLabel}</span>
            </p>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Confirme o que foi executado e avalie o profissional. Leva só alguns minutos.
      </p>
    </div>
  );

  const footer = (
    <Button
      type="button"
      className="w-full transition-transform duration-150 ease-out active:scale-[0.97] sm:w-auto"
      data-testid="pending-evaluation-intro-continue"
      onClick={onContinue}
    >
      Continuar para avaliação
      <ChevronRight className="ml-1.5 h-4 w-4" aria-hidden />
    </Button>
  );

  if (isDesktop) {
    return (
      <div
        className={cn(
          "min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-5 py-4",
          className,
        )}
      >
        {body}
        <div className="flex justify-end border-t border-border/80 pt-4">{footer}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-4 py-4 touch-pan-y">
        {body}
      </div>
      <div className="shrink-0 border-t border-border/80 bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md">
        {footer}
      </div>
    </div>
  );
}
