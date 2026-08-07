/**
 * Provider EXECUTED wizard (Tasks 49–50).
 * Draft checklist + final submit via service_completion_mark_executed.
 * No post-EXECUTED self-serve edit (panel hides when canSaveDraft/canMarkExecuted false).
 * Renders inside CompletionFlowSheetDialog (sticky footer on mobile).
 */

import { useMemo, useRef, useState } from "react";
import {
  CompletionCriterionBlock,
  type CompletionCriterionEvidenceRenderArgs,
  type CompletionCriterionValue,
} from "@/features/dynamic-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useServiceCompletionContext } from "../hooks/useServiceCompletionContext";
import { useProviderCompletionDraft } from "../hooks/useProviderCompletionDraft";
import { useProviderMarkExecuted } from "../hooks/useProviderMarkExecuted";
import { parseCompletionChecklistBlocks } from "../utils/parseChecklistSchema";
import { deriveExecutedTemporalGate } from "../utils/executedTemporal";
import { validateExecutedResponses } from "../utils/validateExecutedResponses";
import type { CompletionCriterionResponse } from "../types/completion.types";
import { CompletionEvidenceGallery } from "./CompletionEvidenceGallery";

export type ProviderExecutedWizardProps = {
  serviceRequestId: string;
  scheduledStartDate?: string | null;
  scheduledEndDate?: string | null;
  className?: string;
  onExecuted?: () => void;
  /** Notified when a mark-executed mutation starts/ends (for dismiss lock). */
  onPendingChange?: (pending: boolean) => void;
};

function toCriterionValue(
  response: CompletionCriterionResponse | undefined,
): CompletionCriterionValue | undefined {
  if (!response) return undefined;
  return {
    met: response.met,
    justification: response.justification,
    evidence_paths: response.evidence_paths ?? [],
  };
}

function renderEvidence(args: CompletionCriterionEvidenceRenderArgs) {
  return (
    <CompletionEvidenceGallery
      paths={args.paths}
      readOnly={args.readOnly}
      onRemovePath={args.readOnly ? undefined : args.onRemovePath}
    />
  );
}

/** Mirrors CompletionCriterionBlock: label, help, Atendido/Não atendido, evidence row. */
function CompletionCriterionBlockSkeleton() {
  return (
    <div className="space-y-3" data-testid="provider-executed-criterion-skeleton">
      <Skeleton className="h-4 w-3/4 max-w-sm" />
      <Skeleton className="h-3.5 w-full max-w-md" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
    </div>
  );
}

function ProviderExecutedWizardSkeleton({
  className,
  isDesktop,
}: {
  className?: string;
  isDesktop: boolean;
}) {
  const criteria = (
    <div className={isDesktop ? "space-y-6" : "space-y-4"}>
      <CompletionCriterionBlockSkeleton />
      <CompletionCriterionBlockSkeleton />
      <CompletionCriterionBlockSkeleton />
    </div>
  );

  const footer = (
    <div
      className={cn("space-y-2", isDesktop && "flex flex-col items-end")}
      data-testid="provider-executed-footer-skeleton"
    >
      <Skeleton
        className={cn("h-10 w-full", isDesktop && "w-56")}
      />
      <Skeleton
        className={cn(
          "h-3 w-full max-w-sm",
          isDesktop ? "ml-auto" : "mx-auto",
        )}
      />
    </div>
  );

  // Match loaded layout: desktop scrolls as one column; mobile keeps sticky footer.
  if (isDesktop) {
    return (
      <div
        className={cn(
          "min-h-[min(52vh,420px)] flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-5 py-4",
          className,
        )}
        aria-busy="true"
        aria-label="Carregando checklist"
        data-testid="provider-executed-wizard-loading"
      >
        {criteria}
        <div className="space-y-2 border-t border-border/80 pt-4">{footer}</div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      aria-busy="true"
      aria-label="Carregando checklist"
      data-testid="provider-executed-wizard-loading"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-4 py-4 touch-pan-y">
        {criteria}
      </div>
      <div className="shrink-0 border-t border-border/80 bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md">
        {footer}
      </div>
    </div>
  );
}

export function ProviderExecutedWizard({
  serviceRequestId,
  scheduledStartDate = null,
  scheduledEndDate = null,
  className,
  onExecuted,
  onPendingChange,
}: ProviderExecutedWizardProps) {
  const { data: context, isLoading, isError, refetch } =
    useServiceCompletionContext(serviceRequestId, {
      pollWhileProcessing: false,
    });

  const draft = useProviderCompletionDraft({
    serviceRequestId,
    context,
  });
  const markExecuted = useProviderMarkExecuted();
  const isDesktop = useBreakpointMd();
  const formRef = useRef<HTMLDivElement>(null);
  const [forceValidate, setForceValidate] = useState(false);
  const [submitGateIssue, setSubmitGateIssue] = useState<string | null>(null);

  const temporal = useMemo(
    () =>
      deriveExecutedTemporalGate({
        scheduledStartDate,
        scheduledEndDate,
      }),
    [scheduledStartDate, scheduledEndDate],
  );

  const canShow =
    Boolean(context?.capabilities.canSaveDraft) ||
    Boolean(context?.capabilities.canMarkExecuted);

  // Keep a layout-stable skeleton while context resolves (avoids title-only flash).
  if (isLoading || (!context && !isError)) {
    return (
      <ProviderExecutedWizardSkeleton
        className={className}
        isDesktop={isDesktop}
      />
    );
  }

  if (isError || !context) {
    return (
      <ErrorState
        className={cn("p-4 sm:p-6", className)}
        title="Não foi possível carregar o checklist"
        description="Verifique a conexão e tente novamente."
        onRetry={() => void refetch()}
      />
    );
  }

  if (!canShow) {
    return null;
  }

  const schema = context.enrichment?.checklistSchema;
  const blocks = parseCompletionChecklistBlocks(schema);
  if (blocks.length === 0) {
    return (
      <Alert className={cn("m-4 sm:m-6", className)}>
        <AlertTitle>Checklist indisponível</AlertTitle>
        <AlertDescription>
          O checklist ainda não está pronto para preenchimento.
        </AlertDescription>
      </Alert>
    );
  }

  const contractedServiceId = context.contractedService.id;
  const canSubmit =
    Boolean(context.capabilities.canMarkExecuted) &&
    Boolean(contractedServiceId) &&
    draft.saveState !== "conflict" &&
    draft.saveState !== "saving" &&
    draft.saveState !== "dirty" &&
    !temporal.notYetDue &&
    !markExecuted.isPending;

  const handleSubmit = async () => {
    if (!contractedServiceId) return;
    setSubmitGateIssue(null);

    const validation = validateExecutedResponses(blocks, draft.responses);
    if (!validation.valid) {
      setForceValidate(true);
      requestAnimationFrame(() => {
        const firstInvalidId = validation.issues[0]?.blockId;
        const root = formRef.current;
        const target = firstInvalidId
          ? root?.querySelector<HTMLElement>(
              `[data-completion-criterion-id="${firstInvalidId}"]`,
            )
          : root?.querySelector<HTMLElement>('[data-invalid="true"]');
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        const justification = target?.querySelector<HTMLTextAreaElement>("textarea");
        justification?.focus({ preventScroll: true });
      });
      return;
    }

    if (temporal.notYetDue) {
      setSubmitGateIssue(
        "Este serviço só pode ser marcado como executado a partir da data agendada.",
      );
      return;
    }

    onPendingChange?.(true);
    try {
      await markExecuted.mutateAsync({
        serviceRequestId,
        contractedServiceId,
        responses: draft.responses,
        expectedDraftVersion: draft.draftVersion,
      });
      onExecuted?.();
    } catch {
      // Toast handled in hook
    } finally {
      onPendingChange?.(false);
    }
  };

  const body = (
    <>
      {temporal.notYetDue ? (
        <Alert data-testid="provider-executed-not-yet-due">
          <AlertTitle>Ainda não é possível marcar como executado</AlertTitle>
          <AlertDescription>
            A data agendada ainda não chegou. Você pode salvar o rascunho do
            checklist agora e enviar a partir do dia do serviço.
          </AlertDescription>
        </Alert>
      ) : null}

      {draft.saveState === "conflict" ? (
        <Alert variant="destructive" data-testid="provider-draft-conflict">
          <AlertTitle>Conflito de versão</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              {draft.saveError ??
                "Este rascunho foi atualizado em outro dispositivo. Recarregue para continuar."}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => void draft.reloadFromServer()}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Recarregar rascunho
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-6" ref={formRef}>
        {blocks.map((block) => {
          // Instructional static_text tips are redundant with field-level UX.
          if (block.type === "static_text") return null;

          if (block.type !== "completion_criterion") return null;

          // Keep fields editable during conflict so keystrokes are not dropped;
          // persistence stays blocked until the user reloads the draft.
          const value = toCriterionValue(draft.responses[block.id]);
          const uploadsBlocked = draft.saveState === "conflict";

          return (
            <div key={block.id} className="space-y-2">
              <CompletionCriterionBlock
                block={block}
                value={value}
                forceValidate={forceValidate}
                renderEvidence={renderEvidence}
                onChange={(next) => {
                  draft.setCriterionResponse(block.id, {
                    met: next.met,
                    justification: next.justification,
                    evidence_paths: next.evidence_paths ?? [],
                  });
                }}
                onUploadEvidenceFile={
                  uploadsBlocked
                    ? undefined
                    : async (file) => {
                        const path = await draft.uploadEvidenceForCriterion(
                          block.id,
                          file,
                        );
                        return path;
                      }
                }
              />
              {draft.uploadingCriterionId === block.id ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Enviando foto…
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {submitGateIssue ? (
        <Alert variant="destructive" data-testid="provider-executed-validation">
          <AlertTitle>Não é possível enviar</AlertTitle>
          <AlertDescription>{submitGateIssue}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );

  const footer =
    context.capabilities.canMarkExecuted ? (
      <div
        className={cn("space-y-2", isDesktop && "flex flex-col items-end")}
      >
        {(draft.saveState === "dirty" || draft.saveState === "saving") && (
          <p
            className={cn(
              "text-xs text-muted-foreground",
              isDesktop ? "text-right" : "text-center",
            )}
          >
            Aguarde o rascunho ser salvo antes de enviar.
          </p>
        )}
        <Button
          type="button"
          className={cn(
            "w-full transition-transform duration-150 ease-out active:scale-[0.97]",
            isDesktop && "w-auto",
          )}
          disabled={!canSubmit}
          data-testid="provider-mark-executed-submit"
          onClick={() => void handleSubmit()}
        >
          {markExecuted.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
          )}
          Marcar serviço como executado
        </Button>
        <p
          className={cn(
            "text-xs text-muted-foreground",
            isDesktop ? "max-w-sm text-right" : "text-center",
          )}
        >
          Após o envio, as respostas ficam congeladas e não poderão ser editadas
          por você.
        </p>
      </div>
    ) : null;

  // Desktop: natural document flow — footer sits after checklist (not sticky).
  // Mobile: sticky footer above the home indicator / keyboard.
  if (isDesktop) {
    return (
      <div
        className={cn(
          "min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-5 py-4",
          className,
        )}
        data-testid="provider-executed-wizard"
        aria-label="Checklist de conclusão"
      >
        {body}
        {footer ? (
          <div className="space-y-2 border-t border-border/80 pt-4">
            {footer}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      data-testid="provider-executed-wizard"
      aria-label="Checklist de conclusão"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-4 py-4 touch-pan-y">
        {body}
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-border/80 bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
