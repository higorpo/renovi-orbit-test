/**
 * Client confirm+rating wizard (Task 51).
 * Order: review frozen evidence → ratings → confirm (or optional post-auto-complete rating).
 */

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
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

export type ClientConfirmRatingWizardProps = {
  serviceRequestId: string;
  className?: string;
  onCompleted?: () => void;
};

type Step = "review" | "rating";

function ClientConfirmRatingWizardSkeleton({
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
}: ClientConfirmRatingWizardProps) {
  const { data: context, isLoading, isError, refetch } =
    useServiceCompletionContext(serviceRequestId, {
      pollWhileProcessing: false,
    });

  const [step, setStep] = useState<Step>("review");
  const [scores, setScores] = useState<RatingScoresDraft>(EMPTY_RATING_SCORES);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const canConfirm = Boolean(context?.capabilities.canConfirmWithRating);
  const canOptional = Boolean(context?.capabilities.canSubmitOptionalRating);
  const showDispute = shouldShowDisputeStub({
    showDisputeStubCapability: context?.capabilities.showDisputeStub,
    csStatus: context?.contractedService.status,
  });
  const mode = canConfirm
    ? ("confirm_with_rating" as const)
    : ("optional_rating" as const);

  const contractedServiceId = context?.contractedService.id ?? "";
  const confirm = useClientConfirmRating({
    serviceRequestId,
    contractedServiceId,
    mode,
  });

  if (isLoading) {
    return <ClientConfirmRatingWizardSkeleton className={className} />;
  }

  if (isError || !context) {
    return (
      <ErrorState
        className={className}
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

  // Dispute-only surface (e.g. COMPLETED after rating already submitted).
  if (!canConfirm && !canOptional && showDispute && contractedId) {
    return (
      <section
        className={cn(
          "space-y-3 rounded-lg border border-border bg-card p-4 shadow-elevation-1 sm:p-5",
          className,
        )}
        data-testid="client-dispute-only-panel"
      >
        <DisputeStubEntry
          contractedServiceId={contractedId}
          csStatus={csStatus}
        />
      </section>
    );
  }

  const title = canConfirm
    ? "Confirmar recebimento"
    : "Avaliar serviço (opcional)";
  const subtitle = canConfirm
    ? "Revise as evidências do profissional e avalie o serviço para confirmar o recebimento."
    : "O serviço foi concluído automaticamente. Você ainda pode deixar uma avaliação.";

  const handleContinueToRating = () => {
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
    try {
      await confirm.mutateAsync(payload);
      onCompleted?.();
    } catch {
      // toast in hook
    }
  };

  return (
    <section
      className={cn(
        "space-y-4 rounded-lg border border-border bg-card p-4 shadow-elevation-1 sm:p-5",
        className,
      )}
      data-testid="client-confirm-rating-wizard"
      data-step={step}
      aria-label={title}
    >
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {step === "review" ? "1 de 2" : "2 de 2"}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </header>

      {step === "review" ? (
        <>
          <FrozenEvidenceReview
            checklistSchema={context.enrichment?.checklistSchema}
            responses={context.evidence.responses}
            executedLate={context.evidence.executedLate}
          />
          <div className="flex justify-end border-t border-border/80 pt-4">
            <Button
              type="button"
              data-testid="client-confirm-continue-rating"
              onClick={handleContinueToRating}
            >
              Continuar para avaliação
              <ChevronRight className="ml-1.5 h-4 w-4" aria-hidden />
            </Button>
          </div>
        </>
      ) : (
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
          <div className="flex flex-col-reverse gap-2 border-t border-border/80 pt-4 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={confirm.isPending}
              onClick={() => setStep("review")}
            >
              <ChevronLeft className="mr-1.5 h-4 w-4" aria-hidden />
              Voltar às evidências
            </Button>
            <Button
              type="button"
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
        </>
      )}

      {showDispute && contractedId ? (
        <DisputeStubEntry
          contractedServiceId={contractedId}
          csStatus={csStatus}
          className="border-t-0"
        />
      ) : null}
    </section>
  );
}
