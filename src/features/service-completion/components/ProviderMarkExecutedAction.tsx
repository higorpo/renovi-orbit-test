/**
 * Provider CTA + sheet/dialog to mark a contracted service as executed.
 * Visibility uses lightweight service-detail fields; completion context loads
 * only when the checklist dialog opens (ProviderExecutedWizard).
 */

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
};

export function ProviderMarkExecutedAction({
  serviceRequestId,
  contractedStatus = null,
  enrichmentReady = false,
  scheduledStartDate = null,
  scheduledEndDate = null,
  onExecuted,
}: ProviderMarkExecutedActionProps) {
  const [open, setOpen] = useState(false);

  // Mirrors get_service_completion_context capabilities without an extra RPC.
  const canShow =
    (contractedStatus ?? "").toUpperCase() === "CONFIRMED" && enrichmentReady;

  if (!canShow) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full rounded-pill text-primary transition-transform duration-fast ease-renovi hover:bg-primary/5 hover:text-primary active:scale-[0.97] sm:w-auto"
        data-testid="provider-mark-executed-action"
        onClick={() => setOpen(true)}
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Marcar serviço como concluído
      </Button>

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
