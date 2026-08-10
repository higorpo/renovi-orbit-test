/**
 * Controlled evaluate sheet/dialog for host surfaces (detail CTA, list card, global prompt).
 *
 * Bodies share one shell:
 * - intro (prompt only) → PendingEvaluationIntroStep
 * - wizard → ClientConfirmRatingWizard (chrome=standard)
 * - success → ClientEvaluateSuccessStep (chrome=immersive)
 */

import { useCallback, useEffect, useState } from "react";
import { CompletionFlowSheetDialog } from "./CompletionFlowSheetDialog";
import { ClientConfirmRatingWizard } from "./ClientConfirmRatingWizard";
import { ClientEvaluateSuccessStep } from "./ClientEvaluateSuccessStep";
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
  /**
   * Optional post-auto-complete: single rating step — hide "N de M" aside.
   * Ignored when variant is "prompt".
   */
  ratingOnly?: boolean;
};

type SheetPhase = "intro" | "wizard" | "success";

const PROMPT_INTRO_TITLE = "É hora de avaliar a execução do serviço";
const PROMPT_INTRO_DESCRIPTION =
  "Revise o resumo abaixo e continue para confirmar a execução e avaliar o profissional.";

const SUCCESS_A11Y_TITLE = "Avaliação enviada com sucesso";

function initialPhase(isPrompt: boolean): SheetPhase {
  return isPrompt ? "intro" : "wizard";
}

function initialStepAside(
  isPrompt: boolean,
  hideStepAside: boolean,
): string | null {
  if (isPrompt) return "1 de 3";
  if (hideStepAside) return null;
  return "1 de 2";
}

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
  ratingOnly = false,
}: ClientEvaluateServiceSheetProps) {
  const isPrompt = variant === "prompt";
  const hideStepAside = ratingOnly && !isPrompt;
  const [dismissDisabled, setDismissDisabled] = useState(false);
  const [phase, setPhase] = useState<SheetPhase>(() => initialPhase(isPrompt));
  const [stepAside, setStepAside] = useState<string | null>(() =>
    initialStepAside(isPrompt, hideStepAside),
  );
  // Freeze success copy at submit time (parent capabilities flip after COMPLETED).
  const [successMode, setSuccessMode] = useState<"confirm" | "optional">(
    hideStepAside ? "optional" : "confirm",
  );

  // Reset bodies when the sheet closes (same pattern as provider mark-executed).
  useEffect(() => {
    if (!open) {
      setPhase(initialPhase(isPrompt));
      setStepAside(initialStepAside(isPrompt, hideStepAside));
      setDismissDisabled(false);
    }
  }, [hideStepAside, isPrompt, open]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setPhase(initialPhase(isPrompt));
        setStepAside(initialStepAside(isPrompt, hideStepAside));
      }
      onOpenChange(nextOpen);
    },
    [hideStepAside, isPrompt, onOpenChange],
  );

  const handleStepChange = useCallback(
    (_step: "review" | "rating", label: string) => {
      setStepAside(label.trim() ? label : null);
    },
    [],
  );

  const isSuccess = phase === "success";
  const showIntro = isPrompt && phase === "intro" && promptSummary;
  const showWizard = open && phase === "wizard";

  const shellTitle = isSuccess
    ? SUCCESS_A11Y_TITLE
    : isPrompt && phase === "intro"
      ? PROMPT_INTRO_TITLE
      : title;
  const shellDescription = isSuccess
    ? undefined
    : isPrompt && phase === "intro"
      ? PROMPT_INTRO_DESCRIPTION
      : description;

  return (
    <CompletionFlowSheetDialog
      open={open}
      onOpenChange={handleOpenChange}
      chrome={isSuccess ? "immersive" : "standard"}
      title={shellTitle}
      description={shellDescription}
      headerAside={
        !isSuccess && stepAside ? (
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
            setSuccessMode(ratingOnly ? "optional" : "confirm");
            setPhase("success");
            setStepAside(null);
            onCompleted?.();
          }}
          onDisputeOpened={() => onOpenChange(false)}
        />
      ) : null}
      {isSuccess ? (
        <ClientEvaluateSuccessStep
          mode={successMode}
          onDismiss={() => onOpenChange(false)}
        />
      ) : null}
    </CompletionFlowSheetDialog>
  );
}
