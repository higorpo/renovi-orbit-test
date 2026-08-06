/**
 * Client CTA + 2-step sheet/dialog to review evidence and rate the service.
 * Skips get_service_completion_context unless contracted status can need evaluate/dispute.
 */

import { useCallback, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServiceCompletionContext } from "../hooks/useServiceCompletionContext";
import { shouldShowDisputeStub, DisputeStubEntry } from "./DisputeStubEntry";
import { CompletionFlowSheetDialog } from "./CompletionFlowSheetDialog";
import { ClientConfirmRatingWizard } from "./ClientConfirmRatingWizard";

export type ClientEvaluateServiceActionProps = {
  serviceRequestId: string;
  /** From get_service — avoids completion-context fetch when not yet eligible. */
  contractedStatus?: string | null;
  onCompleted?: () => void;
};

function shouldFetchEvaluateContext(status: string | null | undefined): boolean {
  if (status == null || status === "") return true;
  const normalized = status.toUpperCase();
  return normalized === "EXECUTED" || normalized === "COMPLETED";
}

export function ClientEvaluateServiceAction({
  serviceRequestId,
  contractedStatus = null,
  onCompleted,
}: ClientEvaluateServiceActionProps) {
  const [open, setOpen] = useState(false);
  const [dismissDisabled, setDismissDisabled] = useState(false);
  const [stepAside, setStepAside] = useState<string | null>("1 de 2");

  const needsContext = shouldFetchEvaluateContext(contractedStatus);
  const { data: context, isLoading } = useServiceCompletionContext(
    needsContext ? serviceRequestId : null,
    { pollWhileProcessing: false },
  );

  const canConfirm = Boolean(context?.capabilities.canConfirmWithRating);
  const canOptional = Boolean(context?.capabilities.canSubmitOptionalRating);
  const showDispute = shouldShowDisputeStub({
    showDisputeStubCapability: context?.capabilities.showDisputeStub,
    csStatus: context?.contractedService.status,
  });
  const contractedId = context?.contractedService.id ?? "";
  const csStatus = context?.contractedService.status ?? "";

  const handleStepChange = useCallback(
    (_step: "review" | "rating", label: string) => {
      setStepAside(label);
    },
    [],
  );

  if (!needsContext) {
    return null;
  }

  if (isLoading) {
    return null;
  }

  // After rating, only dispute stub may remain — keep it inline (no evaluate CTA).
  if (!canConfirm && !canOptional) {
    if (showDispute && contractedId) {
      return (
        <div
          className="w-full sm:max-w-sm"
          data-testid="client-dispute-only-inline"
        >
          <DisputeStubEntry
            contractedServiceId={contractedId}
            csStatus={csStatus}
          />
        </div>
      );
    }
    return null;
  }

  const title = canConfirm ? "Avaliar serviço" : "Avaliar serviço (opcional)";
  const description = canConfirm
    ? "Revise o que foi executado e avalie o profissional em duas etapas rápidas."
    : "O serviço foi concluído automaticamente. Você ainda pode deixar uma avaliação.";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full rounded-pill text-primary transition-transform duration-fast ease-renovi hover:bg-primary/5 hover:text-primary active:scale-[0.97] sm:w-auto"
        data-testid="client-evaluate-service-action"
        onClick={() => {
          setStepAside("1 de 2");
          setOpen(true);
        }}
      >
        <Star className="h-4 w-4" aria-hidden />
        Avaliar serviço
      </Button>

      <CompletionFlowSheetDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        headerAside={
          stepAside ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
              {stepAside}
            </span>
          ) : null
        }
        dismissDisabled={dismissDisabled}
        size="md"
        testId="client-evaluate-service-sheet"
      >
        {open ? (
          <ClientConfirmRatingWizard
            serviceRequestId={serviceRequestId}
            onPendingChange={setDismissDisabled}
            onStepChange={handleStepChange}
            onCompleted={() => {
              setOpen(false);
              onCompleted?.();
            }}
          />
        ) : null}
      </CompletionFlowSheetDialog>
    </>
  );
}
