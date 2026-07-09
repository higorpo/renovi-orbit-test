import { useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";
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
import {
  SavedCardSelector,
  type SavedCardSelectorMode,
} from "./SavedCardSelector";
import { CARD_FORM_ID } from "./CardForm";
import { useClientCpfForPayment } from "../../hooks/useClientCpfForPayment";

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

function StepActions({
  onBack,
  onContinue,
  continueDisabled,
  continueLabel = "Continuar",
  continueType = "button",
  continueForm,
  isPending = false,
}: {
  onBack?: () => void;
  onContinue?: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  continueType?: "button" | "submit";
  continueForm?: string;
  isPending?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack} disabled={isPending}>
          Voltar
        </Button>
      ) : null}
      <Button
        type={continueType}
        form={continueForm}
        disabled={continueDisabled || isPending}
        onClick={continueType === "button" ? onContinue : undefined}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Salvando cartão...
          </>
        ) : (
          continueLabel
        )}
      </Button>
    </div>
  );
}

export type CheckoutStepContentProps = {
  stepper: CheckoutStepperRenderProps;
  proposalId?: string;
  serviceId?: string;
  chatId?: string | null;
  checkoutContext?: CheckoutContext;
  onCheckoutSuccess?: (contractedServiceId: string) => void;
};

export function CheckoutStepContent({
  stepper,
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
    goBack,
    goToStep,
    canGoBack,
    setClearsaleSessionId,
    clearsaleSessionId,
  } = stepper;

  const idempotencyKey = useMemo(() => generateIdempotencyKeyV7(), []);
  const { profile } = useAuth();
  const { cpf: profileCpf } = useClientCpfForPayment();
  const resolvedCpf = stepData.cpf ?? profileCpf;
  const resolvedPhone = stepData.phone ?? profile?.phone ?? undefined;

  const [cardMode, setCardMode] = useState<SavedCardSelectorMode>("list");
  const [canContinueCard, setCanContinueCard] = useState(false);
  const [canGoBackCard, setCanGoBackCard] = useState(false);
  const [isCardPending, setIsCardPending] = useState(false);
  const [canContinueInstallments, setCanContinueInstallments] = useState(false);
  const cardContinueRef = useRef<(() => void) | null>(null);
  const cardBackRef = useRef<(() => void) | null>(null);
  const installmentContinueRef = useRef<(() => void) | null>(null);

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
            <div className="space-y-4">
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
                onBack={canGoBack ? goBack : undefined}
                formId={CARD_FORM_ID}
                onModeChange={setCardMode}
                onCanContinueChange={setCanContinueCard}
                onCanGoBackChange={setCanGoBackCard}
                onPendingChange={setIsCardPending}
                continueRef={cardContinueRef}
                backRef={cardBackRef}
              />
              <StepActions
                onBack={canGoBackCard ? () => cardBackRef.current?.() : undefined}
                onContinue={() => cardContinueRef.current?.()}
                continueDisabled={!canContinueCard}
                continueType={cardMode === "form" ? "submit" : "button"}
                continueForm={cardMode === "form" ? CARD_FORM_ID : undefined}
                isPending={isCardPending}
              />
            </div>
          ) : (
            <DefaultStepPlaceholder step="card" />
          )}
        </CardStep>
      );
    case "installments":
      return proposalId && serviceId && stepData.cardBrand && stepData.cardTokenId ? (
        <div className="space-y-4">
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
            onCanContinueChange={setCanContinueInstallments}
            continueRef={installmentContinueRef}
          />
          <StepActions
            onBack={canGoBack ? goBack : undefined}
            onContinue={() => installmentContinueRef.current?.()}
            continueDisabled={!canContinueInstallments}
          />
        </div>
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
          chatId={chatId}
          serviceRequestId={serviceId ?? null}
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
