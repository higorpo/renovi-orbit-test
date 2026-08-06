/**
 * Controlled evaluate sheet/dialog for host surfaces (detail CTA, list card, global prompt).
 * ClientConfirmRatingWizard loads completion context only while open (and after intro Continuar).
 */

import { useCallback, useEffect, useState } from "react";
import { CompletionFlowSheetDialog } from "./CompletionFlowSheetDialog";
import { ClientConfirmRatingWizard } from "./ClientConfirmRatingWizard";
import { PendingEvaluationIntroStep } from "./PendingEvaluationIntroStep";
import type { PendingEvaluationPromptSummary } from "../api/pendingEvaluationPrompt.api";

export type ClientEvaluateServiceSheetVariant = "default" | "prompt";

export type ClientEvaluateServiceSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceRequestId: string;
  title?: string;
  description?: string;
  onCompleted?: () => void;
  testId?: string;
  /** Global pending-evaluation prompt: intro → review → rating (3 steps). */
  variant?: ClientEvaluateServiceSheetVariant;
  promptSummary?: PendingEvaluationPromptSummary | null;
};

const PROMPT_INTRO_TITLE = "É hora de avaliar a execução do serviço";
const PROMPT_INTRO_DESCRIPTION =
  "Revise o resumo abaixo e continue para confirmar a execução e avaliar o profissional.";

export function ClientEvaluateServiceSheet({
  open,
  onOpenChange,
  serviceRequestId,
  title = "Avaliar serviço",
  description = "Revise o que foi executado e avalie o profissional em duas etapas rápidas.",
  onCompleted,
  testId = "client-evaluate-service-sheet",
  variant = "default",
  promptSummary = null,
}: ClientEvaluateServiceSheetProps) {
  const isPrompt = variant === "prompt";
  const [dismissDisabled, setDismissDisabled] = useState(false);
  const [phase, setPhase] = useState<"intro" | "wizard">(
    isPrompt ? "intro" : "wizard",
  );
  const [stepAside, setStepAside] = useState<string | null>(
    isPrompt ? "1 de 3" : "1 de 2",
  );

  useEffect(() => {
    if (!open) return;
    if (isPrompt) {
      setPhase("intro");
      setStepAside("1 de 3");
      return;
    }
    setPhase("wizard");
    setStepAside("1 de 2");
  }, [isPrompt, open, serviceRequestId]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setPhase(isPrompt ? "intro" : "wizard");
        setStepAside(isPrompt ? "1 de 3" : "1 de 2");
      }
      onOpenChange(nextOpen);
    },
    [isPrompt, onOpenChange],
  );

  const handleStepChange = useCallback(
    (_step: "review" | "rating", label: string) => {
      setStepAside(label);
    },
    [],
  );

  const shellTitle =
    isPrompt && phase === "intro" ? PROMPT_INTRO_TITLE : title;
  const shellDescription =
    isPrompt && phase === "intro" ? PROMPT_INTRO_DESCRIPTION : description;

  const showIntro = isPrompt && phase === "intro" && promptSummary;
  const showWizard = open && (!isPrompt || phase === "wizard");

  return (
    <CompletionFlowSheetDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={shellTitle}
      description={shellDescription}
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
      {showIntro ? (
        <PendingEvaluationIntroStep
          summary={promptSummary}
          onContinue={() => {
            setPhase("wizard");
            setStepAside("2 de 3");
          }}
        />
      ) : null}
      {showWizard ? (
        <ClientConfirmRatingWizard
          serviceRequestId={serviceRequestId}
          variant={isPrompt ? "prompt" : "default"}
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
