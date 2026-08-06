/**
 * Controlled mark-executed sheet/dialog for host surfaces (detail CTA, list card).
 * Completion context loads inside ProviderExecutedWizard only while open.
 */

import { useState } from "react";
import { CompletionFlowSheetDialog } from "./CompletionFlowSheetDialog";
import { ProviderExecutedWizard } from "./ProviderExecutedWizard";

export type ProviderMarkExecutedSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceRequestId: string;
  scheduledStartDate?: string | null;
  scheduledEndDate?: string | null;
  onExecuted?: () => void;
  testId?: string;
};

export function ProviderMarkExecutedSheet({
  open,
  onOpenChange,
  serviceRequestId,
  scheduledStartDate = null,
  scheduledEndDate = null,
  onExecuted,
  testId = "provider-mark-executed-sheet",
}: ProviderMarkExecutedSheetProps) {
  const [dismissDisabled, setDismissDisabled] = useState(false);

  return (
    <CompletionFlowSheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Checklist de conclusão"
      description="Preencha os critérios e envie quando o serviço estiver concluído. O cliente só verá as respostas após a marcação como executado."
      dismissDisabled={dismissDisabled}
      size="md"
      testId={testId}
    >
      {open ? (
        <ProviderExecutedWizard
          serviceRequestId={serviceRequestId}
          scheduledStartDate={scheduledStartDate}
          scheduledEndDate={scheduledEndDate}
          onPendingChange={setDismissDisabled}
          onExecuted={() => {
            onOpenChange(false);
            onExecuted?.();
          }}
        />
      ) : null}
    </CompletionFlowSheetDialog>
  );
}
