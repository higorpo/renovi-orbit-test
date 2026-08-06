/**
 * Client CTA + 2-step sheet/dialog to review evidence and rate the service.
 * Skips get_service_completion_context unless contracted status can need evaluate.
 * Dispute stub is not shown on the service detail host — only inside the evaluate wizard.
 */

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServiceCompletionContext } from "../hooks/useServiceCompletionContext";
import { ClientEvaluateServiceSheet } from "./ClientEvaluateServiceSheet";

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

  const needsContext = shouldFetchEvaluateContext(contractedStatus);
  const { data: context, isLoading } = useServiceCompletionContext(
    needsContext ? serviceRequestId : null,
    { pollWhileProcessing: false },
  );

  const canConfirm = Boolean(context?.capabilities.canConfirmWithRating);
  const canOptional = Boolean(context?.capabilities.canSubmitOptionalRating);

  if (!needsContext) {
    return null;
  }

  if (isLoading) {
    return null;
  }

  if (!canConfirm && !canOptional) {
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
        onClick={() => setOpen(true)}
      >
        <Star className="h-4 w-4" aria-hidden />
        Avaliar serviço
      </Button>

      <ClientEvaluateServiceSheet
        open={open}
        onOpenChange={setOpen}
        serviceRequestId={serviceRequestId}
        title={title}
        description={description}
        onCompleted={onCompleted}
      />
    </>
  );
}
