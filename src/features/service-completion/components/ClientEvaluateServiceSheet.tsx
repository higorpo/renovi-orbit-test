/**
 * Controlled evaluate sheet/dialog for host surfaces (detail CTA, list card).
 * ClientConfirmRatingWizard loads completion context only while open.
 */

import { useCallback, useState } from "react";
import { CompletionFlowSheetDialog } from "./CompletionFlowSheetDialog";
import { ClientConfirmRatingWizard } from "./ClientConfirmRatingWizard";

export type ClientEvaluateServiceSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceRequestId: string;
  title?: string;
  description?: string;
  onCompleted?: () => void;
  testId?: string;
};

export function ClientEvaluateServiceSheet({
  open,
  onOpenChange,
  serviceRequestId,
  title = "Avaliar serviço",
  description = "Revise o que foi executado e avalie o profissional em duas etapas rápidas.",
  onCompleted,
  testId = "client-evaluate-service-sheet",
}: ClientEvaluateServiceSheetProps) {
  const [dismissDisabled, setDismissDisabled] = useState(false);
  const [stepAside, setStepAside] = useState<string | null>("1 de 2");

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setStepAside("1 de 2");
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const handleStepChange = useCallback(
    (_step: "review" | "rating", label: string) => {
      setStepAside(label);
    },
    [],
  );

  return (
    <CompletionFlowSheetDialog
      open={open}
      onOpenChange={handleOpenChange}
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
      testId={testId}
    >
      {open ? (
        <ClientConfirmRatingWizard
          serviceRequestId={serviceRequestId}
          onPendingChange={setDismissDisabled}
          onStepChange={handleStepChange}
          onCompleted={() => {
            onOpenChange(false);
            onCompleted?.();
          }}
        />
      ) : null}
    </CompletionFlowSheetDialog>
  );
}
