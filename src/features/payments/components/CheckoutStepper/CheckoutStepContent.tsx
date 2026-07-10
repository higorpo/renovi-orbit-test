import { useMemo } from "react";
import { useAuth } from "@/features/auth";
import { ConfirmationStep } from "./ConfirmationStep";
import { InstallmentSelector } from "../InstallmentSelector";
import { generateIdempotencyKeyV7 } from "@/lib/utils/idempotencyKey";
import type { CheckoutHostBindings } from "../../hooks/useCheckoutHostActions";
import type { UseCheckoutStepperResult } from "../../hooks/useCheckoutStepper";
import type { CheckoutContext } from "../../types/checkoutStepper.types";
import { CardStep } from "./CardStep";
import { CpfStep } from "./CpfStep";
import { PhoneStep } from "./PhoneStep";
import { SavedCardSelector } from "./SavedCardSelector";
import { useClientCpfForPayment } from "../../hooks/useClientCpfForPayment";

export type CheckoutStepContentProps = {
  stepper: UseCheckoutStepperResult;
  hostBindings: CheckoutHostBindings;
  proposalId?: string;
  serviceId?: string;
  chatId?: string | null;
  checkoutContext?: CheckoutContext;
  onCheckoutSuccess?: (contractedServiceId: string) => void;
};

/** Step body only — host dialog owns Voltar/Continuar via useCheckoutHostActions. */
export function CheckoutStepContent({
  stepper,
  hostBindings,
  proposalId,
  serviceId,
  chatId = null,
  checkoutContext,
  onCheckoutSuccess,
}: CheckoutStepContentProps) {
  const {
    currentStep,
    stepData,
    completeStep,
    goToStep,
    setClearsaleSessionId,
    clearsaleSessionId,
  } = stepper;

  const idempotencyKey = useMemo(() => generateIdempotencyKeyV7(), []);
  const { profile } = useAuth();
  const { cpf: profileCpf } = useClientCpfForPayment();
  const resolvedCpf = stepData.cpf ?? profileCpf;
  const resolvedPhone = stepData.phone ?? profile?.phone ?? undefined;

  switch (currentStep) {
    case "cpf":
      return (
        <CpfStep
          defaultCpf={stepData.cpf ?? ""}
          onComplete={(cpf) => completeStep({ cpf })}
        />
      );
    case "phone":
      return (
        <PhoneStep
          defaultPhone={stepData.phone ?? ""}
          onComplete={(phone) => completeStep({ phone })}
        />
      );
    case "card":
      if (!proposalId) {
        return null;
      }
      return (
        <CardStep onSessionIdGenerated={setClearsaleSessionId}>
          <SavedCardSelector
            providerServiceId={proposalId}
            savedCpf={resolvedCpf}
            phone={resolvedPhone}
            onSelect={(selection) =>
              completeStep({
                cardTokenId: selection.paymentTokenId,
                cardBrand: selection.cardBrand,
              })
            }
            onCanContinueChange={hostBindings.onCanContinueCardChange}
            continueRef={hostBindings.cardContinueRef}
          />
        </CardStep>
      );
    case "installments":
      if (!proposalId || !serviceId || !stepData.cardBrand || !stepData.cardTokenId) {
        return null;
      }
      return (
        <InstallmentSelector
          proposalId={proposalId}
          serviceId={serviceId}
          cardBrand={stepData.cardBrand}
          paymentTokenId={stepData.cardTokenId}
          onSelect={(selection) =>
            completeStep({
              installmentNumber: selection.installmentNumber,
              hmac: selection.installmentSelectionHmac,
              installmentHmacPayload: selection.installmentHmacPayload,
              installmentAmount: selection.installmentAmount,
              totalWithFees: selection.totalWithFees,
              installmentOptions: selection.installmentOptions,
              installmentComputedAt: selection.computedAt,
              installmentExpiresAt: selection.expiresAt,
            })
          }
          onCanContinueChange={hostBindings.onCanContinueInstallmentsChange}
          continueRef={hostBindings.installmentContinueRef}
        />
      );
    case "confirmation":
      if (
        !proposalId
        || !checkoutContext
        || !stepData.cardTokenId
        || !stepData.installmentNumber
        || !stepData.hmac
        || !stepData.installmentHmacPayload
        || stepData.installmentAmount == null
        || stepData.totalWithFees == null
      ) {
        return null;
      }
      return (
        <ConfirmationStep
          serviceTitle={checkoutContext.serviceTitle}
          scheduledDate={checkoutContext.scheduledDate}
          installmentNumber={stepData.installmentNumber}
          installmentAmount={stepData.installmentAmount}
          totalWithFees={stepData.totalWithFees}
          proposalId={proposalId}
          selectedSlot={checkoutContext.selectedSlot}
          pricingSignature={checkoutContext.pricingSignature}
          paymentTokenId={stepData.cardTokenId}
          clearsaleSessionId={clearsaleSessionId}
          installmentSelectionHmac={stepData.hmac}
          installmentHmacPayload={stepData.installmentHmacPayload}
          installmentOptions={stepData.installmentOptions ?? []}
          idempotencyKey={idempotencyKey}
          chatId={chatId}
          serviceRequestId={serviceId ?? null}
          onSuccess={(contractedServiceId) => onCheckoutSuccess?.(contractedServiceId)}
          onInstallmentSignatureExpired={() => goToStep("installments")}
          confirmRef={hostBindings.confirmRef}
          onPendingChange={hostBindings.onConfirmPendingChange}
        />
      );
    default:
      return null;
  }
}
