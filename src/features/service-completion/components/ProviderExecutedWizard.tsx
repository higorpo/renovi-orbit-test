/**
 * Provider EXECUTED wizard (Tasks 49–50).
 * Draft checklist + final submit via service_completion_mark_executed.
 * No post-EXECUTED self-serve edit (panel hides when canSaveDraft/canMarkExecuted false).
 */

import { useMemo, useState } from "react";
import {
  CompletionCriterionBlock,
  StaticTextBlock,
  type CompletionCriterionValue,
  type FormBlock,
} from "@/features/dynamic-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useServiceCompletionContext } from "../hooks/useServiceCompletionContext";
import { useProviderCompletionDraft } from "../hooks/useProviderCompletionDraft";
import { useProviderMarkExecuted } from "../hooks/useProviderMarkExecuted";
import { parseCompletionChecklistBlocks } from "../utils/parseChecklistSchema";
import { deriveExecutedTemporalGate } from "../utils/executedTemporal";
import { validateExecutedResponses } from "../utils/validateExecutedResponses";
import type { CompletionCriterionResponse } from "../types/completion.types";

export type ProviderExecutedWizardProps = {
  serviceRequestId: string;
  scheduledStartDate?: string | null;
  scheduledEndDate?: string | null;
  className?: string;
  onExecuted?: () => void;
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

function saveStatusLabel(
  saveState: ReturnType<typeof useProviderCompletionDraft>["saveState"],
): string | null {
  switch (saveState) {
    case "dirty":
      return "Alterações pendentes…";
    case "saving":
      return "Salvando rascunho…";
    case "saved":
      return "Rascunho salvo";
    case "error":
      return "Erro ao salvar";
    default:
      return null;
  }
}

function renderStatic(block: FormBlock) {
  return <StaticTextBlock block={block} />;
}

function ProviderExecutedWizardSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-4 rounded-lg border border-border bg-card p-4 shadow-elevation-1 sm:p-5",
        className,
      )}
      aria-busy="true"
      aria-label="Carregando checklist"
      data-testid="provider-executed-wizard-loading"
    >
      <div className="space-y-2">
        <Skeleton className="h-5 w-52 max-w-full" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
      <div className="flex justify-end border-t border-border/80 pt-4">
        <Skeleton className="h-10 w-40" />
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
}: ProviderExecutedWizardProps) {
  const queryClient = useQueryClient();
  const { data: context, isLoading, isError, refetch } =
    useServiceCompletionContext(serviceRequestId, {
      pollWhileProcessing: false,
    });

  const draft = useProviderCompletionDraft({
    serviceRequestId,
    context,
  });
  const markExecuted = useProviderMarkExecuted();
  const [submitIssues, setSubmitIssues] = useState<string[]>([]);

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

  if (isLoading) {
    return <ProviderExecutedWizardSkeleton className={className} />;
  }

  if (isError || !context) {
    return (
      <ErrorState
        className={className}
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
      <Alert className={className}>
        <AlertTitle>Checklist indisponível</AlertTitle>
        <AlertDescription>
          O checklist ainda não está pronto para preenchimento.
        </AlertDescription>
      </Alert>
    );
  }

  const statusLabel = saveStatusLabel(draft.saveState);
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
    setSubmitIssues([]);

    const validation = validateExecutedResponses(blocks, draft.responses);
    if (!validation.valid) {
      setSubmitIssues(
        validation.issues.map((i) => `${i.label}: ${i.error}`),
      );
      return;
    }

    if (temporal.notYetDue) {
      setSubmitIssues([
        "Este serviço só pode ser marcado como executado a partir da data agendada.",
      ]);
      return;
    }

    try {
      await markExecuted.mutateAsync({
        serviceRequestId,
        contractedServiceId,
        responses: draft.responses,
        expectedDraftVersion: draft.draftVersion,
      });
      // Invalidate list/detail queries owned by view-services via callback.
      onExecuted?.();
      void queryClient.invalidateQueries({
        queryKey: ["services"],
      });
    } catch {
      // Toast handled in hook
    }
  };

  return (
    <section
      className={cn(
        "space-y-4 rounded-lg border border-border bg-card p-4 shadow-elevation-1 sm:p-5",
        className,
      )}
      data-testid="provider-executed-wizard"
      aria-label="Checklist de conclusão"
    >
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">
          Checklist de conclusão
        </h2>
        <p className="text-sm text-muted-foreground">
          Preencha os critérios e envie quando o serviço estiver concluído. O cliente só
          verá as respostas após a marcação como executado.
        </p>
        {statusLabel ? (
          <p
            className="text-xs text-muted-foreground"
            data-testid="provider-draft-save-status"
            data-state={draft.saveState}
          >
            {statusLabel}
          </p>
        ) : null}
      </header>

      {temporal.notYetDue ? (
        <Alert data-testid="provider-executed-not-yet-due">
          <AlertTitle>Ainda não é possível marcar como executado</AlertTitle>
          <AlertDescription>
            A data agendada ainda não chegou. Você pode salvar o rascunho do checklist
            agora e enviar a partir do dia do serviço.
          </AlertDescription>
        </Alert>
      ) : null}

      {temporal.willBeLate && !temporal.notYetDue ? (
        <Alert data-testid="provider-executed-late-notice">
          <AlertTitle>Envio fora do prazo</AlertTitle>
          <AlertDescription>
            A janela on-time já passou. Você ainda pode marcar como executado; o cliente
            verá que a execução foi registrada com atraso.
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

      <div className="space-y-6">
        {blocks.map((block) => {
          if (block.type === "static_text") {
            return (
              <div key={block.id} className="rounded-lg bg-muted/40 px-3 py-2">
                {renderStatic(block)}
              </div>
            );
          }

          if (block.type !== "completion_criterion") return null;

          const readOnly = draft.saveState === "conflict";
          const value = toCriterionValue(draft.responses[block.id]);

          return (
            <div key={block.id} className="space-y-2">
              <CompletionCriterionBlock
                block={block}
                value={value}
                readOnly={readOnly}
                onChange={(next) => {
                  setSubmitIssues([]);
                  draft.setCriterionResponse(block.id, {
                    met: next.met,
                    justification: next.justification,
                    evidence_paths: next.evidence_paths ?? [],
                  });
                }}
                onUploadEvidenceFile={
                  readOnly
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

      {submitIssues.length > 0 ? (
        <Alert variant="destructive" data-testid="provider-executed-validation">
          <AlertTitle>Checklist incompleto</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
              {submitIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {context.capabilities.canMarkExecuted ? (
        <div className="space-y-2 border-t border-border/80 pt-4">
          {(draft.saveState === "dirty" || draft.saveState === "saving") && (
            <p className="text-xs text-muted-foreground">
              Aguarde o rascunho ser salvo antes de enviar.
            </p>
          )}
          <Button
            type="button"
            className="w-full sm:w-auto"
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
          <p className="text-xs text-muted-foreground">
            Após o envio, as respostas ficam congeladas e não poderão ser editadas por
            você.
          </p>
        </div>
      ) : null}
    </section>
  );
}
