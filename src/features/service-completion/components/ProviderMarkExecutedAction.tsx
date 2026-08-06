/**
 * Provider CTA + sheet/dialog to mark a contracted service as executed.
 */

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServiceCompletionContext } from "../hooks/useServiceCompletionContext";
import { CompletionFlowSheetDialog } from "./CompletionFlowSheetDialog";
import { ProviderExecutedWizard } from "./ProviderExecutedWizard";

export type ProviderMarkExecutedActionProps = {
  serviceRequestId: string;
  scheduledStartDate?: string | null;
  scheduledEndDate?: string | null;
  onExecuted?: () => void;
};

export function ProviderMarkExecutedAction({
  serviceRequestId,
  scheduledStartDate = null,
  scheduledEndDate = null,
  onExecuted,
}: ProviderMarkExecutedActionProps) {
  const [open, setOpen] = useState(false);
  const [dismissDisabled, setDismissDisabled] = useState(false);
  const { data: context, isLoading } = useServiceCompletionContext(
    serviceRequestId,
    { pollWhileProcessing: false },
  );

  const canShow =
    Boolean(context?.capabilities.canSaveDraft) ||
    Boolean(context?.capabilities.canMarkExecuted);

  if (isLoading || !canShow) {
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

      <CompletionFlowSheetDialog
        open={open}
        onOpenChange={setOpen}
        title="Checklist de conclusão"
        description="Preencha os critérios e envie quando o serviço estiver concluído. O cliente só verá as respostas após a marcação como executado."
        dismissDisabled={dismissDisabled}
        size="md"
        testId="provider-mark-executed-sheet"
      >
        {open ? (
          <ProviderExecutedWizard
            serviceRequestId={serviceRequestId}
            scheduledStartDate={scheduledStartDate}
            scheduledEndDate={scheduledEndDate}
            onPendingChange={setDismissDisabled}
            onExecuted={() => {
              setOpen(false);
              onExecuted?.();
            }}
          />
        ) : null}
      </CompletionFlowSheetDialog>
    </>
  );
}
