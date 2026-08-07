/**
 * Client confirm+rating wizard (Task 51).
 * Manual path: review frozen evidence → ratings → confirm.
 * Optional post-auto-complete: rating only (no checklist, ack, or dispute).
 * Renders inside CompletionFlowSheetDialog (scroll + sticky footer on mobile).
 */

import { useEffect, useState } from "react";
import type { CompletionCriterionEvidenceRenderArgs } from "@/features/dynamic-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useServiceCompletionContext } from "../hooks/useServiceCompletionContext";
import { useClientConfirmRating } from "../hooks/useClientConfirmRating";
import { FrozenEvidenceReview } from "./FrozenEvidenceReview";
import {
  DisputeStubEntry,
  shouldShowDisputeStub,
} from "./DisputeStubEntry";
import {
  EMPTY_RATING_SCORES,
  ServiceRatingForm,
  isRatingScoresComplete,
  toServiceRatingScores,
  type RatingScoresDraft,
} from "./ServiceRatingForm";
import { CompletionEvidenceGallery } from "./CompletionEvidenceGallery";

export type ClientConfirmRatingWizardVariant = "default" | "prompt";

export type ClientConfirmRatingWizardProps = {
  serviceRequestId: string;
  className?: string;
  onCompleted?: () => void;
  onPendingChange?: (pending: boolean) => void;
  /** Bubble step to the shell header (e.g. "1 de 2" or "2 de 3" for prompt). */
  onStepChange?: (step: "review" | "rating", label: string) => void;
  /** Prompt flow already showed intro as step 1 — labels become 2/3 de 3. */
  variant?: ClientConfirmRatingWizardVariant;
};

type Step = "review" | "rating";

function renderEvidence(args: CompletionCriterionEvidenceRenderArgs) {
  return (
    <CompletionEvidenceGallery
      paths={args.paths}
      readOnly={args.readOnly}
      onRemovePath={args.readOnly ? undefined : args.onRemovePath}
    />
  );
}

function ClientConfirmRatingWizardSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6",
        className,
      )}
      aria-busy="true"
      aria-label="Carregando evidências"
      data-testid="client-confirm-rating-loading"
    >
      <div className="space-y-2">
        <Skeleton className="h-5 w-48 max-w-full" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
      <div className="flex justify-end border-t border-border/80 pt-4">
        <Skeleton className="h-10 w-44" />
      </div>
    </div>
  );
}

export function ClientConfirmRatingWizard({
  serviceRequestId,
  className,
  onCompleted,
  onPendingChange,
  onStepChange,
  variant = "default",
}: ClientConfirmRatingWizardProps) {
  const { data: context, isLoading, isError, refetch } =
    useServiceCompletionContext(serviceRequestId, {
      pollWhileProcessing: false,
    });

  const [step, setStep] = useState<Step>("review");
  const [scores, setScores] = useState<RatingScoresDraft>(EMPTY_RATING_SCORES);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [executionAcknowledged, setExecutionAcknowledged] = useState(false);
  const isDesktop = useBreakpointMd();
  const isPrompt = variant === "prompt";

  const canConfirm = Boolean(context?.capabilities.canConfirmWithRating);
  const canOptional = Boolean(context?.capabilities.canSubmitOptionalRating);
  const isOptionalOnly = canOptional && !canConfirm;
  const showDispute =
    !isOptionalOnly &&
    shouldShowDisputeStub({
      showDisputeStubCapability: context?.capabilities.showDisputeStub,
      csStatus: context?.contractedService.status,
    });
  const mode = canConfirm
    ? ("confirm_with_rating" as const)
    : ("optional_rating" as const);
  const effectiveStep: Step = isOptionalOnly ? "rating" : step;

  const contractedServiceId = context?.contractedService.id ?? "";
  const confirm = useClientConfirmRating({
    serviceRequestId,
    contractedServiceId,
    mode,
  });

  const title = canConfirm
    ? "Confirmar recebimento"
    : "Avaliar serviço (opcional)";
  const stepLabel = isOptionalOnly
    ? ""
    : isPrompt
      ? effectiveStep === "review"
        ? "2 de 3"
        : "3 de 3"
      : effectiveStep === "review"
        ? "1 de 2"
        : "2 de 2";

  useEffect(() => {
    if (!canConfirm && !canOptional) return;
    onStepChange?.(effectiveStep, stepLabel);
  }, [canConfirm, canOptional, effectiveStep, onStepChange, stepLabel]);

  if (isLoading) {
    return <ClientConfirmRatingWizardSkeleton className={className} />;
  }

  if (isError || !context) {
    return (
      <ErrorState
        className={cn("p-4 sm:p-6", className)}
        title="Não foi possível carregar a conclusão"
        description="Verifique a conexão e tente novamente."
        onRetry={() => void refetch()}
      />
    );
  }

  if (!canConfirm && !canOptional && !showDispute) {
    return null;
  }

  const contractedId = context.contractedService.id ?? "";
  const csStatus = context.contractedService.status ?? "";

  const autoWithoutChecklist = Boolean(
    context.evidence.autoExecutedWithoutChecklist,
  );

  // Dispute-only surface (e.g. COMPLETED after rating already submitted).
  if (!canConfirm && !canOptional && showDispute && contractedId) {
    return (
      <section
        className={cn("space-y-3 p-4 sm:p-6", className)}
        data-testid="client-dispute-only-panel"
      >
        <DisputeStubEntry
          contractedServiceId={contractedId}
          csStatus={csStatus}
          autoExecutedWithoutChecklist={autoWithoutChecklist}
        />
      </section>
    );
  }

  const handleContinueToRating = () => {
    if (!executionAcknowledged) return;
    setStep("rating");
    setScoreError(null);
  };

  const handleSubmit = async () => {
    if (!isRatingScoresComplete(scores)) {
      setScoreError("Informe as quatro notas (1 a 5) para continuar.");
      return;
    }
    const payload = toServiceRatingScores(scores);
    if (!payload) {
      setScoreError("Informe as quatro notas (1 a 5) para continuar.");
      return;
    }
    setScoreError(null);
    onPendingChange?.(true);
    try {
      await confirm.mutateAsync(payload);
      onCompleted?.();
    } catch {
      // toast in hook
    } finally {
      onPendingChange?.(false);
    }
  };

  const reviewBody = (
    <FrozenEvidenceReview
      checklistSchema={context.enrichment?.checklistSchema}
      responses={context.evidence.responses}
      autoExecutedWithoutChecklist={autoWithoutChecklist}
      renderEvidence={renderEvidence}
    />
  );

  const ratingBody = (
    <>
      <ServiceRatingForm
        value={scores}
        onChange={(next) => {
          setScores(next);
          setScoreError(null);
        }}
        disabled={confirm.isPending}
      />
      {scoreError ? (
        <Alert variant="destructive" data-testid="client-rating-score-error">
          <AlertTitle>Notas incompletas</AlertTitle>
          <AlertDescription>{scoreError}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );

  const dispute =
    showDispute && contractedId ? (
      <DisputeStubEntry
        contractedServiceId={contractedId}
        csStatus={csStatus}
        className="border-t-0"
        autoExecutedWithoutChecklist={autoWithoutChecklist}
      />
    ) : null;

  const executionAck = (
    <div
      className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-3"
      data-testid="client-confirm-execution-ack"
    >
      <Checkbox
        id="client-confirm-execution-acknowledged"
        checked={executionAcknowledged}
        onCheckedChange={(checked) =>
          setExecutionAcknowledged(checked === true)
        }
        className="shrink-0"
        data-testid="client-confirm-execution-acknowledged"
      />
      <label
        htmlFor="client-confirm-execution-acknowledged"
        className="cursor-pointer text-sm font-normal leading-snug text-foreground"
      >
        {autoWithoutChecklist
          ? "Declaro que o serviço foi executado corretamente, conforme o combinado."
          : "Declaro que revisei as evidências acima e que o serviço foi executado corretamente, conforme o combinado."}
      </label>
    </div>
  );

  const reviewFooter = (
    <Button
      type="button"
      className="w-full transition-transform duration-150 ease-out active:scale-[0.97] sm:w-auto"
      data-testid="client-confirm-continue-rating"
      disabled={!executionAcknowledged}
      onClick={handleContinueToRating}
    >
      Continuar para avaliação
      <ChevronRight className="ml-1.5 h-4 w-4" aria-hidden />
    </Button>
  );

  const ratingFooter = (
    <div
      className={cn(
        "flex w-full flex-col-reverse gap-2 sm:flex-row",
        isOptionalOnly ? "sm:justify-end" : "sm:justify-between",
      )}
    >
      {isOptionalOnly ? null : (
        <Button
          type="button"
          variant="outline"
          className="w-full transition-transform duration-150 ease-out active:scale-[0.97] sm:w-auto"
          disabled={confirm.isPending}
          onClick={() => setStep("review")}
        >
          <ChevronLeft className="mr-1.5 h-4 w-4" aria-hidden />
          {autoWithoutChecklist ? "Voltar" : "Voltar às evidências"}
        </Button>
      )}
      <Button
        type="button"
        className="w-full transition-transform duration-150 ease-out active:scale-[0.97] sm:w-auto"
        data-testid="client-confirm-submit"
        disabled={confirm.isPending}
        onClick={() => void handleSubmit()}
      >
        {confirm.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Check className="mr-2 h-4 w-4" aria-hidden />
        )}
        {canConfirm ? "Confirmar e avaliar" : "Enviar avaliação"}
      </Button>
    </div>
  );

  if (isDesktop) {
    return (
      <div
        className={cn(
          "min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-5 py-4",
          className,
        )}
        data-testid="client-confirm-rating-wizard"
        data-step={effectiveStep}
        aria-label={title}
      >
        {effectiveStep === "review" ? (
          <>
            {reviewBody}
            {dispute}
            {executionAck}
          </>
        ) : (
          ratingBody
        )}
        <div className="border-t border-border/80 pt-4">
          {effectiveStep === "review" ? (
            <div className="flex justify-end">{reviewFooter}</div>
          ) : (
            ratingFooter
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      data-testid="client-confirm-rating-wizard"
      data-step={effectiveStep}
      aria-label={title}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-4 py-4 touch-pan-y">
        {effectiveStep === "review" ? (
          <>
            {reviewBody}
            {dispute}
            {executionAck}
          </>
        ) : (
          ratingBody
        )}
      </div>
      <div className="shrink-0 border-t border-border/80 bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-md">
        {effectiveStep === "review" ? reviewFooter : ratingFooter}
      </div>
    </div>
  );
}
