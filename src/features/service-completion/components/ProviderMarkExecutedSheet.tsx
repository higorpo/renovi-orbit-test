/**
 * Controlled mark-executed sheet/dialog for host surfaces (detail CTA, list card).
 *
 * Two bodies share one shell:
 * - checklist → ProviderExecutedWizard (chrome=standard)
 * - success → ProviderExecutedSuccessStep (chrome=immersive)
 *
 * Completion context loads inside the wizard only while open.
 */

import { useEffect, useState } from "react";
import { CompletionFlowSheetDialog } from "./CompletionFlowSheetDialog";
import { ProviderExecutedSuccessStep } from "./ProviderExecutedSuccessStep";
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

type SheetPhase = "checklist" | "success";

const CHECKLIST_TITLE = "Checklist de conclusão";
const CHECKLIST_DESCRIPTION =
  "Preencha os critérios e envie quando o serviço estiver concluído. O cliente só verá as respostas após a marcação como executado.";

/** sr-only when immersive — visible copy lives in ProviderExecutedSuccessStep. */
const SUCCESS_A11Y_TITLE = "Checklist enviado com sucesso";

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
  const [phase, setPhase] = useState<SheetPhase>("checklist");

  useEffect(() => {
    if (!open) {
      setPhase("checklist");
      setDismissDisabled(false);
    }
  }, [open]);

  const isSuccess = phase === "success";

  return (
    <CompletionFlowSheetDialog
      open={open}
      onOpenChange={onOpenChange}
      chrome={isSuccess ? "immersive" : "standard"}
      title={isSuccess ? SUCCESS_A11Y_TITLE : CHECKLIST_TITLE}
      description={isSuccess ? undefined : CHECKLIST_DESCRIPTION}
      dismissDisabled={dismissDisabled}
      size="md"
      testId={testId}
    >
      {!open ? null : isSuccess ? (
        <ProviderExecutedSuccessStep
          onDismiss={() => onOpenChange(false)}
        />
      ) : (
        <ProviderExecutedWizard
          serviceRequestId={serviceRequestId}
          scheduledStartDate={scheduledStartDate}
          scheduledEndDate={scheduledEndDate}
          onPendingChange={setDismissDisabled}
          onExecuted={() => {
            setPhase("success");
            onExecuted?.();
          }}
        />
      )}
    </CompletionFlowSheetDialog>
  );
}
