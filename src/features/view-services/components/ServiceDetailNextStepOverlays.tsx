import { ManualPaymentDialog } from "@/features/payments";
import {
  ClientEvaluateServiceSheet,
  ProviderMarkExecutedSheet,
} from "@/features/service-completion";
import type { UseServiceDetailNextStepResult } from "../hooks/useServiceDetailNextStep";
import type { ServiceModel } from "../types/service.types";
import type { ServiceNextStep } from "../utils/serviceNextStep";

interface ServiceDetailNextStepOverlaysProps {
  model: ServiceModel;
  role: "client" | "provider" | string | null | undefined;
  step: ServiceNextStep | null;
  nextStep: Pick<
    UseServiceDetailNextStepResult,
    | "evaluateOpen"
    | "setEvaluateOpen"
    | "markExecutedOpen"
    | "setMarkExecutedOpen"
    | "ratingOnly"
    | "invalidateServiceQueries"
    | "manualPayment"
    | "needsManualPayment"
  >;
}

export function ServiceDetailNextStepOverlays({
  model,
  role,
  step,
  nextStep,
}: ServiceDetailNextStepOverlaysProps) {
  const {
    evaluateOpen,
    setEvaluateOpen,
    markExecutedOpen,
    setMarkExecutedOpen,
    ratingOnly,
    invalidateServiceQueries,
    manualPayment,
    needsManualPayment,
  } = nextStep;

  return (
    <>
      {needsManualPayment && manualPayment.schedule && manualPayment.context ? (
        <ManualPaymentDialog
          open={manualPayment.open}
          onOpenChange={manualPayment.handleOpenChange}
          schedule={manualPayment.schedule}
          acceptedProposalId={manualPayment.context.acceptedProposalId}
          serviceRequestId={manualPayment.context.serviceRequestId}
          onCompleted={manualPayment.handleCompleted}
        />
      ) : null}

      {evaluateOpen || (role === "client" && step?.intent === "evaluate_service") ? (
        <ClientEvaluateServiceSheet
          open={evaluateOpen}
          onOpenChange={setEvaluateOpen}
          serviceRequestId={model.id}
          title={ratingOnly ? "Avaliar serviço (opcional)" : "Avaliar serviço"}
          description={
            ratingOnly
              ? "O serviço foi concluído automaticamente. Você ainda pode deixar uma avaliação."
              : "Revise o que foi executado e avalie o profissional em duas etapas rápidas."
          }
          ratingOnly={ratingOnly}
          onCompleted={invalidateServiceQueries}
          testId="service-detail-next-step-evaluate-sheet"
        />
      ) : null}

      {role === "provider" && (step?.intent === "mark_executed" || markExecutedOpen) ? (
        <ProviderMarkExecutedSheet
          open={markExecutedOpen}
          onOpenChange={setMarkExecutedOpen}
          serviceRequestId={model.id}
          scheduledStartDate={model.contracted?.scheduledStartDate}
          scheduledEndDate={model.contracted?.scheduledEndDate}
          onExecuted={invalidateServiceQueries}
          testId="service-detail-next-step-mark-executed-sheet"
        />
      ) : null}
    </>
  );
}
