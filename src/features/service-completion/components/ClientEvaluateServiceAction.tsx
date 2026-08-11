/**
 * Client CTA + sheet/dialog to rate the service.
 * Manual (EXECUTED): review evidence + declaration → rating.
 * Optional (COMPLETED by system): rating only — no checklist or dispute.
 * Skips get_service_completion_context unless contracted status can need evaluate.
 * Dispute entry is not shown on the service detail host — only inside the evaluate wizard (EXECUTED).
 *
 * After submit, capabilities flip off — keep the sheet mounted while `open` so the
 * immersive success step is not unmounted.
 */

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useServiceCompletionContext } from "../hooks/useServiceCompletionContext";
import { ClientEvaluateServiceSheet } from "./ClientEvaluateServiceSheet";

export type ClientEvaluateServiceActionProps = {
  serviceRequestId: string;
  /** From get_service — avoids completion-context fetch when not yet eligible. */
  contractedStatus?: string | null;
  onCompleted?: () => void;
  className?: string;
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
  className,
}: ClientEvaluateServiceActionProps) {
  const [open, setOpen] = useState(false);

  const needsContext = shouldFetchEvaluateContext(contractedStatus);
  const { data: context, isLoading } = useServiceCompletionContext(
    needsContext ? serviceRequestId : null,
    { pollWhileProcessing: false },
  );

  const canConfirm = Boolean(context?.capabilities.canConfirmWithRating);
  const canOptional = Boolean(context?.capabilities.canSubmitOptionalRating);
  const canEvaluate = canConfirm || canOptional;

  // After rating, context/capabilities clear — keep sheet alive for success step.
  if (!open) {
    if (!needsContext) return null;
    if (isLoading) return null;
    if (!canEvaluate) return null;
  }

  const title = canConfirm ? "Avaliar serviço" : "Avaliar serviço (opcional)";
  const description = canConfirm
    ? "Revise o que foi executado e avalie o profissional em duas etapas rápidas."
    : "O serviço foi concluído automaticamente. Você ainda pode deixar uma avaliação.";

  return (
    <>
      {canEvaluate ? (
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full rounded-pill text-primary transition-transform duration-fast ease-renovi hover:bg-primary/5 hover:text-primary active:scale-[0.97] sm:w-auto",
            className,
          )}
          data-testid="client-evaluate-service-action"
          onClick={() => setOpen(true)}
        >
          <Star className="h-4 w-4" aria-hidden />
          Avaliar serviço
        </Button>
      ) : null}

      <ClientEvaluateServiceSheet
        open={open}
        onOpenChange={setOpen}
        serviceRequestId={serviceRequestId}
        title={canEvaluate ? title : "Avaliar serviço"}
        description={
          canEvaluate
            ? description
            : "Revise o que foi executado e avalie o profissional."
        }
        ratingOnly={!canConfirm && canOptional}
        onCompleted={onCompleted}
      />
    </>
  );
}
