/**
 * Intro step for the pending-evaluation prompt (before evidence review).
 * Keeps the lightweight RPC summary — full completion context loads after Continuar.
 */

import { Button } from "@/components/ui/button";
import { getServiceCardStyle } from "@/features/request-quote";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";
import { formatCalendarDate } from "@/lib/utils/calendarDate";
import { formatDatePtBr } from "@/lib/utils/formatDate";
import { ChevronRight } from "lucide-react";
import type { PendingEvaluationPromptSummary } from "../api/pendingEvaluationPrompt.api";

export type PendingEvaluationIntroStepProps = {
  summary: PendingEvaluationPromptSummary;
  onContinue: () => void;
  className?: string;
};

/** Service completion date: scheduled_end_date, else scheduled_start_date. */
function formatCompletionDateLabel(
  scheduledEndDate: string | null,
  scheduledStartDate: string | null,
): string | null {
  const raw = scheduledEndDate || scheduledStartDate;
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return formatCalendarDate(raw);
  }
  return formatDatePtBr(raw);
}

export function PendingEvaluationIntroStep({
  summary,
  onContinue,
  className,
}: PendingEvaluationIntroStepProps) {
  const isDesktop = useBreakpointMd();
  const completionLabel = formatCompletionDateLabel(
    summary.scheduledEndDate,
    summary.scheduledStartDate,
  );
  const serviceStyle = getServiceCardStyle({
    icon_key: summary.iconKey,
    color_key: summary.colorKey,
  });
  const ServiceIcon = serviceStyle.Icon;

  const body = (
    <div
      className="space-y-4"
      data-testid="pending-evaluation-intro"
    >
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
            serviceStyle.color,
          )}
          aria-hidden
          data-testid="pending-evaluation-intro-service-icon"
        >
          <ServiceIcon className="h-4 w-4" />
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
          {completionLabel ? (
            <p className="text-sm text-muted-foreground">
              Conclusão:{" "}
              <span className="font-medium text-foreground">
                {completionLabel}
              </span>
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

  // Flex column so the CTA stays pinned to the dialog/sheet bottom
  // (CompletionFlowSheetDialog body uses a min-height on desktop).
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div
        className={cn(
          "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain py-4",
          isDesktop ? "px-5" : "px-4 touch-pan-y",
        )}
      >
        {body}
      </div>
      <div
        className={cn(
          "shrink-0 border-t border-border/80 bg-background/95 py-3 backdrop-blur-md",
          isDesktop
            ? "flex justify-end px-5"
            : "px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)]",
        )}
      >
        {footer}
      </div>
    </div>
  );
}
