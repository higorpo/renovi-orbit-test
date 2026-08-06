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
import { CalendarDays, ChevronRight, UserRound } from "lucide-react";
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

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-medium leading-snug text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
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
  const categoryLabel = summary.categoryTitle?.trim() || "Serviço";

  const body = (
    <div
      className="space-y-4"
      data-testid="pending-evaluation-intro"
    >
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex min-w-0 items-center gap-3 border-b border-border/60 px-4 py-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
              serviceStyle.color,
            )}
            aria-hidden
            data-testid="pending-evaluation-intro-service-icon"
          >
            <ServiceIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {categoryLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              Pronto para avaliação
            </p>
          </div>
        </div>

        <div className="space-y-3 px-4 py-3.5">
          <h3 className="text-base font-semibold leading-snug text-foreground">
            {summary.title}
          </h3>

          {summary.providerFullName || completionLabel ? (
            <div className="flex flex-col gap-2.5 rounded-lg border border-border/40 bg-muted/30 px-3 py-2.5">
              {summary.providerFullName ? (
                <MetaRow
                  icon={UserRound}
                  label="Prestador"
                  value={summary.providerFullName}
                />
              ) : null}
              {completionLabel ? (
                <MetaRow
                  icon={CalendarDays}
                  label="Conclusão do serviço"
                  value={completionLabel}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        Confirme o que foi executado e avalie o profissional. Leva só alguns
        minutos.
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
