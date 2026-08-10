/**
 * Controlled evaluate sheet/dialog for host surfaces (detail CTA, list card, global prompt).
 *
 * Bodies share one shell:
 * - intro (prompt only) → PendingEvaluationIntroStep
 * - wizard → ClientConfirmRatingWizard (chrome=standard)
 * - success → ClientEvaluateSuccessStep (chrome=immersive)
 *
 * Dispute confirm opens as a sibling after this sheet is hidden locally.
 * We do NOT call parent onOpenChange(false) until the dispute flow ends —
 * hosts (Meus Serviços, prompt) clear model/id on close and would unmount us.
 */

import { useCallback, useEffect, useState } from "react";
import { CompletionFlowSheetDialog } from "./CompletionFlowSheetDialog";
import {
  ClientConfirmRatingWizard,
  type OpenDisputeRequestPayload,
} from "./ClientConfirmRatingWizard";
import { ClientEvaluateSuccessStep } from "./ClientEvaluateSuccessStep";
import { OpenDisputeConfirmDialog } from "./OpenDisputeConfirmDialog";
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
  /** Hide evaluate shell without telling parent (keeps this component mounted). */
  const [evaluateSuppressed, setEvaluateSuppressed] = useState(false);
  const [pendingDispute, setPendingDispute] =
    useState<OpenDisputeRequestPayload | null>(null);
  const [disputeConfirmOpen, setDisputeConfirmOpen] = useState(false);

  const evaluateOpen = open && !evaluateSuppressed;

  // Reset bodies when the parent closes the sheet.
  useEffect(() => {
    if (!open) {
      setPhase(initialPhase(isPrompt));
      setStepAside(initialStepAside(isPrompt, hideStepAside));
      setDismissDisabled(false);
      setEvaluateSuppressed(false);
      setPendingDispute(null);
      setDisputeConfirmOpen(false);
    }
  }, [hideStepAside, isPrompt, open]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      // Ignore shell close while we only suppressed evaluate for the dispute dialog
      // (hosts clear model/id on onOpenChange(false) and would unmount this tree).
      if (!nextOpen && evaluateSuppressed) {
        return;
      }
      if (nextOpen) {
        setPhase(initialPhase(isPrompt));
        setStepAside(initialStepAside(isPrompt, hideStepAside));
        setEvaluateSuppressed(false);
        setPendingDispute(null);
        setDisputeConfirmOpen(false);
      }
      onOpenChange(nextOpen);
    },
    [evaluateSuppressed, hideStepAside, isPrompt, onOpenChange],
  );

  const handleStepChange = useCallback(
    (_step: "review" | "rating", label: string) => {
      setStepAside(label.trim() ? label : null);
    },
    [],
  );

  const handleRequestOpenDispute = useCallback(
    (payload: OpenDisputeRequestPayload) => {
      setPendingDispute(payload);
      setEvaluateSuppressed(true);
      setDisputeConfirmOpen(true);
    },
    [],
  );

  const handleDisputeConfirmOpenChange = useCallback(
    (nextOpen: boolean) => {
      setDisputeConfirmOpen(nextOpen);
      if (nextOpen) return;
      // Cancelled: bring evaluate back (parent still thinks the flow is open).
      setPendingDispute(null);
      setEvaluateSuppressed(false);
    },
    [],
  );

  const handleDisputeOpened = useCallback(() => {
    setDisputeConfirmOpen(false);
    setPendingDispute(null);
    setEvaluateSuppressed(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const isSuccess = phase === "success";
  const showIntro =
    evaluateOpen && isPrompt && phase === "intro" && promptSummary;
  const showWizard = evaluateOpen && phase === "wizard";

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
    <>
      <CompletionFlowSheetDialog
        open={evaluateOpen}
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
            onRequestOpenDispute={handleRequestOpenDispute}
          />
        ) : null}
        {isSuccess ? (
          <ClientEvaluateSuccessStep
            mode={successMode}
            onDismiss={() => onOpenChange(false)}
          />
        ) : null}
      </CompletionFlowSheetDialog>

      {pendingDispute ? (
        <OpenDisputeConfirmDialog
          open={disputeConfirmOpen}
          onOpenChange={handleDisputeConfirmOpenChange}
          serviceRequestId={serviceRequestId}
          contractedServiceId={pendingDispute.contractedServiceId}
          onOpened={handleDisputeOpened}
        />
      ) : null}
    </>
  );
}
