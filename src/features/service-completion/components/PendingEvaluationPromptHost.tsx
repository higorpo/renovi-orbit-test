import { ClientEvaluateServiceSheet } from "./ClientEvaluateServiceSheet";
import { usePendingEvaluationPrompt } from "../hooks/usePendingEvaluationPrompt";

export function PendingEvaluationPromptHost() {
  const {
    open,
    serviceRequestId,
    promptSummary,
    setOpen,
    onCompleted,
  } = usePendingEvaluationPrompt();

  if (!serviceRequestId || !promptSummary) {
    return null;
  }

  return (
    <ClientEvaluateServiceSheet
      open={open}
      onOpenChange={setOpen}
      serviceRequestId={serviceRequestId}
      variant="prompt"
      promptSummary={promptSummary}
      onCompleted={onCompleted}
      testId="pending-evaluation-prompt-sheet"
    />
  );
}
