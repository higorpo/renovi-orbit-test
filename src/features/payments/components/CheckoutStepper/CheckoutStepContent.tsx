import { useMemo } from "react";
import { ConfirmationStep } from "./ConfirmationStep";
import { InstallmentSelector } from "../InstallmentSelector";
import { generateIdempotencyKeyV7 } from "@/lib/utils/idempotencyKey";
import type { CheckoutContext } from "../../types/checkoutStepper.types";
import type { CheckoutStepperRenderProps } from "./CheckoutStepper";
import type { CheckoutStepId } from "../../types/checkoutStepper.types";
import { CardStep } from "./CardStep";
import { CHECKOUT_STEP_LABELS } from "./checkoutStepLabels";
import { CpfStep } from "./CpfStep";
import { PhoneStep } from "./PhoneStep";
import { SavedCardSelector } from "./SavedCardSelector";

function DefaultStepPlaceholder({ step }: { step: CheckoutStepId }) {
  return (
    <div
      data-testid={`checkout-step-${step}`}
      className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
    >
      Etapa: {CHECKOUT_STEP_LABELS[step]}
    </div>
  );
}

export type CheckoutStepContentProps = {
  stepper: CheckoutStepperRenderProps;
  proposalId?: string;
  serviceId?: string;
  checkoutContext?: CheckoutContext;
  onCheckoutSuccess?: (contractedServiceId: string) => void;
};

export function CheckoutStepContent({
  stepper,
  proposalId,
  serviceId,
  checkoutContext,
  onCheckoutSuccess,
}: CheckoutStepContentProps) {
  const {
    currentStep,
    stepData,
    completeStep,
    goBack,
    goToStep,
    canGoBack,
    setClearsaleSessionId,
    clearsaleSessionId,
  } = stepper;

  const idempotencyKey = useMemo(() => generateIdempotencyKeyV7(), []);

  switch (currentStep) {
    case "cpf":
      return (
        <CpfStep
          defaultCpf={stepData.cpf ?? ""}
          onComplete={(cpf) => completeStep({ cpf })}
          onBack={canGoBack ? goBack : undefined}
        />
      );
    case "phone":
      return (
        <PhoneStep
          defaultPhone={stepData.phone ?? ""}
          onComplete={(phone) => completeStep({ phone })}
          onBack={canGoBack ? goBack : undefined}
        />
      );
    case "card":
      return (
        <CardStep onSessionIdGenerated={setClearsaleSessionId}>
          {proposalId ? (
            <SavedCardSelector
              providerServiceId={proposalId}
              cpf={stepData.cpf}
              phone={stepData.phone}
              onSelect={(selection) =>
                completeStep({
                  cardTokenId: selection.paymentTokenId,
                  cardBrand: selection.cardBrand,
                })
              }
              onBack={canGoBack ? goBack : undefined}
            />
          ) : (
            <DefaultStepPlaceholder step="card" />
          )}
        </CardStep>
      );
    case "installments":
      return proposalId && serviceId && stepData.cardBrand && stepData.cardTokenId ? (
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
          onBack={canGoBack ? goBack : undefined}
        />
      ) : (
        <DefaultStepPlaceholder step="installments" />
      );
    case "confirmation":
      return proposalId
        && checkoutContext
        && stepData.cardTokenId
        && stepData.installmentNumber
        && stepData.hmac
        && stepData.installmentHmacPayload
        && stepData.installmentAmount != null
        && stepData.totalWithFees != null ? (
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
          onSuccess={(contractedServiceId) => onCheckoutSuccess?.(contractedServiceId)}
          onInstallmentSignatureExpired={() => goToStep("installments")}
          onBack={canGoBack ? goBack : undefined}
        />
      ) : (
        <DefaultStepPlaceholder step="confirmation" />
      );
    default:
      return <DefaultStepPlaceholder step={currentStep} />;
  }
}
