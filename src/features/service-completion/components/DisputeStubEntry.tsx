/**
 * Client-only dispute stub entry (Task 52 / design §11.6).
 * No dispute FSM — opens support URL or "Em breve" toast.
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageCircleWarning } from "lucide-react";
import { useDisputeStub } from "../hooks/useDisputeStub";

export type DisputeStubEntryProps = {
  contractedServiceId: string;
  csStatus: string;
  className?: string;
  remoteSupportUrl?: string | null;
  /** When true, omit checklist-based wording (auto-mark EXECUTED without checklist). */
  autoExecutedWithoutChecklist?: boolean;
};

const DISPUTE_COPY_WITH_CHECKLIST =
  "Se você acha que há algo errado na execução do serviço com base no checklist evidenciado acima, ou se algo não foi cumprido corretamente, pode abrir uma disputa. A plataforma avalia os detalhes e pode pedir ao prestador que corrija o que não está bom, ou devolver parcial ou integralmente o valor pago.";

const DISPUTE_COPY_WITHOUT_CHECKLIST =
  "Se você acha que há algo errado na execução do serviço, ou se algo não foi cumprido corretamente, pode abrir uma disputa. A plataforma avalia os detalhes e pode pedir ao prestador que corrija o que não está bom, ou devolver parcial ou integralmente o valor pago.";

export function DisputeStubEntry({
  contractedServiceId,
  csStatus,
  className,
  remoteSupportUrl,
  autoExecutedWithoutChecklist = false,
}: DisputeStubEntryProps) {
  const { openDisputeStub } = useDisputeStub();
  const description = autoExecutedWithoutChecklist
    ? DISPUTE_COPY_WITHOUT_CHECKLIST
    : DISPUTE_COPY_WITH_CHECKLIST;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/30 px-3 py-3",
        className,
      )}
      data-testid="dispute-stub-entry"
    >
      <div className="flex items-start gap-3">
        <MessageCircleWarning
          className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Abrir disputa</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            data-testid="dispute-stub-open"
            onClick={() =>
              openDisputeStub({
                contractedServiceId,
                csStatus,
                remoteSupportUrl,
              })
            }
          >
            Falar com o suporte
          </Button>
        </div>
      </div>
    </div>
  );
}

/** True when client should see the stub — EXECUTED confirm window only (not after COMPLETED). */
export function shouldShowDisputeStub(input: {
  showDisputeStubCapability?: boolean;
  csStatus?: string | null;
}): boolean {
  if (input.showDisputeStubCapability) return true;
  const status = (input.csStatus ?? "").toUpperCase();
  return status === "EXECUTED";
}
