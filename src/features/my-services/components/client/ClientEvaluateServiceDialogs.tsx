import { ClientEvaluateServiceSheet } from "@/features/service-completion";
import type { useClientEvaluateServiceDialog } from "../../hooks/useClientEvaluateServiceDialog";

interface ClientEvaluateServiceDialogsProps {
  dialog: ReturnType<typeof useClientEvaluateServiceDialog>;
}

export function ClientEvaluateServiceDialogs({ dialog }: ClientEvaluateServiceDialogsProps) {
  const { open, model, handleOpenChange, handleCompleted } = dialog;

  if (!model) return null;

  return (
    <ClientEvaluateServiceSheet
      open={open}
      onOpenChange={handleOpenChange}
      serviceRequestId={model.id}
      onCompleted={handleCompleted}
      testId="client-card-evaluate-service-sheet"
    />
  );
}
