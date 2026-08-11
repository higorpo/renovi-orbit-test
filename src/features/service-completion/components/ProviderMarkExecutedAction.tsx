/**
 * Provider CTA + sheet/dialog to mark a contracted service as executed.
 * Visibility uses lightweight service-detail fields; completion context loads
 * only when the checklist dialog opens (ProviderExecutedWizard).
 *
 * After mark-executed the parent status becomes EXECUTED — keep the sheet mounted
 * while `open` so the immersive success step is not unmounted by canShow=false.
 */

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProviderMarkExecutedSheet } from "./ProviderMarkExecutedSheet";

export type ProviderMarkExecutedActionProps = {
  serviceRequestId: string;
  /** Contracted service status from get_service (CONFIRMED = eligible). */
  contractedStatus?: string | null;
  /** Enrichment ready flag from get_service; required to mark executed. */
  enrichmentReady?: boolean;
  scheduledStartDate?: string | null;
  scheduledEndDate?: string | null;
  onExecuted?: () => void;
  className?: string;
};

export function ProviderMarkExecutedAction({
  serviceRequestId,
  contractedStatus = null,
  enrichmentReady = false,
  scheduledStartDate = null,
  scheduledEndDate = null,
  onExecuted,
  className,
}: ProviderMarkExecutedActionProps) {
  const [open, setOpen] = useState(false);

  // Mirrors get_service_completion_context capabilities without an extra RPC.
  const canOpenChecklist =
    (contractedStatus ?? "").toUpperCase() === "CONFIRMED" && enrichmentReady;

  // After EXECUTED, parent refetch would unmount us and kill the success step.
  if (!canOpenChecklist && !open) {
    return null;
  }

  return (
    <>
      {canOpenChecklist ? (
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full rounded-pill text-primary transition-transform duration-fast ease-prestway hover:bg-primary/5 hover:text-primary active:scale-[0.97] sm:w-auto",
            className,
          )}
          data-testid="provider-mark-executed-action"
          onClick={() => setOpen(true)}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Marcar serviço como concluído
        </Button>
      ) : null}

      <ProviderMarkExecutedSheet
        open={open}
        onOpenChange={setOpen}
        serviceRequestId={serviceRequestId}
        scheduledStartDate={scheduledStartDate}
        scheduledEndDate={scheduledEndDate}
        onExecuted={onExecuted}
      />
    </>
  );
}
