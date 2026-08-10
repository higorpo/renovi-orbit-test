/**
 * Client entry to open a service dispute (EXECUTED confirm window).
 * Opens confirmation dialog with optional reason → RPC.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageCircleWarning } from "lucide-react";
import { OpenDisputeConfirmDialog } from "./OpenDisputeConfirmDialog";

export type OpenDisputeEntryProps = {
  serviceRequestId: string;
  contractedServiceId: string;
  className?: string;
  /** When true, omit checklist-based wording (auto-mark EXECUTED without checklist). */
  autoExecutedWithoutChecklist?: boolean;
  /** After dispute opens successfully (e.g. close evaluate wizard). */
  onOpened?: () => void;
};

const DISPUTE_COPY_WITH_CHECKLIST =
  "Se você acha que há algo errado na execução do serviço com base no checklist evidenciado acima, ou se algo não foi cumprido corretamente, pode abrir uma disputa. A plataforma avalia os detalhes e pode pedir ao prestador que corrija o que não está bom, ou devolver parcial ou integralmente o valor pago.";

const DISPUTE_COPY_WITHOUT_CHECKLIST =
  "Se você acha que há algo errado na execução do serviço, ou se algo não foi cumprido corretamente, pode abrir uma disputa. A plataforma avalia os detalhes e pode pedir ao prestador que corrija o que não está bom, ou devolver parcial ou integralmente o valor pago.";

export function OpenDisputeEntry({
  serviceRequestId,
  contractedServiceId,
  className,
  autoExecutedWithoutChecklist = false,
  onOpened,
}: OpenDisputeEntryProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const description = autoExecutedWithoutChecklist
    ? DISPUTE_COPY_WITHOUT_CHECKLIST
    : DISPUTE_COPY_WITH_CHECKLIST;

  return (
    <>
      <div
        className={cn(
          "rounded-lg border border-border bg-muted/30 px-3 py-3",
          className,
        )}
        data-testid="open-dispute-entry"
      >
        <div className="flex items-start gap-3">
          <MessageCircleWarning
            className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">
                Abrir disputa
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              data-testid="open-dispute-cta"
              onClick={() => setConfirmOpen(true)}
            >
              Abrir disputa
            </Button>
          </div>
        </div>
      </div>

      <OpenDisputeConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        serviceRequestId={serviceRequestId}
        contractedServiceId={contractedServiceId}
        onOpened={onOpened}
      />
    </>
  );
}

/** True when client should see the open-dispute entry (EXECUTED confirm window). */
export function shouldShowOpenDispute(input: {
  canOpenDispute?: boolean;
  /** @deprecated Prefer canOpenDispute */
  showDisputeStubCapability?: boolean;
  csStatus?: string | null;
}): boolean {
  if (input.canOpenDispute) return true;
  if (input.showDisputeStubCapability) return true;
  const status = (input.csStatus ?? "").toUpperCase();
  return status === "EXECUTED";
}
