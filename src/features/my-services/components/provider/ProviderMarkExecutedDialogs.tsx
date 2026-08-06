import { ProviderMarkExecutedSheet } from "@/features/service-completion";
import type { useProviderMarkExecutedDialog } from "../../hooks/useProviderMarkExecutedDialog";

interface ProviderMarkExecutedDialogsProps {
  dialog: ReturnType<typeof useProviderMarkExecutedDialog>;
}

export function ProviderMarkExecutedDialogs({ dialog }: ProviderMarkExecutedDialogsProps) {
  const { open, model, handleOpenChange, handleExecuted } = dialog;

  if (!model) return null;

  return (
    <ProviderMarkExecutedSheet
      open={open}
      onOpenChange={handleOpenChange}
      serviceRequestId={model.id}
      scheduledStartDate={model.contracted?.scheduledStartDate}
      scheduledEndDate={model.contracted?.scheduledEndDate}
      onExecuted={handleExecuted}
      testId="provider-card-mark-executed-sheet"
    />
  );
}
