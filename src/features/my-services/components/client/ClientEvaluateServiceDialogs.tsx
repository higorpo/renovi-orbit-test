import { ClientEvaluateServiceSheet } from "@/features/service-completion";
import type { useClientEvaluateServiceDialog } from "../../hooks/useClientEvaluateServiceDialog";

interface ClientEvaluateServiceDialogsProps {
  dialog: ReturnType<typeof useClientEvaluateServiceDialog>;
}

export function ClientEvaluateServiceDialogs({ dialog }: ClientEvaluateServiceDialogsProps) {
  const { open, model, handleOpenChange, handleCompleted } = dialog;

  if (!model) return null;

  // COMPLETED without a rating ⇒ system auto-complete; rating-only sheet (no checklist/dispute).
  const ratingOnly =
    model.contracted?.status === "COMPLETED" &&
    model.contracted.clientRatingOverallScore == null;

  return (
    <ClientEvaluateServiceSheet
      open={open}
      onOpenChange={handleOpenChange}
      serviceRequestId={model.id}
      title={ratingOnly ? "Avaliar serviço (opcional)" : "Avaliar serviço"}
      description={
        ratingOnly
          ? "O serviço foi concluído automaticamente. Você ainda pode deixar uma avaliação."
          : "Revise o que foi executado e avalie o profissional em duas etapas rápidas."
      }
      ratingOnly={ratingOnly}
      onCompleted={handleCompleted}
      testId="client-card-evaluate-service-sheet"
    />
  );
}
