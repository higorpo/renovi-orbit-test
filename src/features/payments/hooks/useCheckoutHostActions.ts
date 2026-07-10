import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { CPF_STEP_FORM_ID, PHONE_STEP_FORM_ID } from "../constants/checkoutFormIds";
import type { CheckoutHostActions } from "../types/checkoutHostActions.types";
import type { UseCheckoutStepperResult } from "./useCheckoutStepper";

function requestFormSubmit(formId: string) {
  const form = document.getElementById(formId);
  if (form instanceof HTMLFormElement) {
    form.requestSubmit();
  }
}

export type CheckoutHostBindings = {
  cardContinueRef: MutableRefObject<(() => void) | null>;
  installmentContinueRef: MutableRefObject<(() => void) | null>;
  confirmRef: MutableRefObject<(() => void) | null>;
  onCanContinueCardChange: (canContinue: boolean) => void;
  onCanContinueInstallmentsChange: (canContinue: boolean) => void;
  onConfirmPendingChange: (pending: boolean) => void;
};

/**
 * Footer actions + continue refs for a host dialog that owns Voltar/Continuar.
 * Mirrors ManualPaymentDialog's continueRef + canContinue pattern.
 */
export function useCheckoutHostActions(stepper: UseCheckoutStepperResult): {
  actions: CheckoutHostActions | null;
  bindings: CheckoutHostBindings;
} {
  const {
    currentStep,
    canGoBack,
    goBack,
    clearsaleSessionId,
    isLoadingRequirements,
    requirementsError,
  } = stepper;

  const [canContinueCard, setCanContinueCard] = useState(false);
  const [canContinueInstallments, setCanContinueInstallments] = useState(false);
  const [isConfirmPending, setIsConfirmPending] = useState(false);
  const cardContinueRef = useRef<(() => void) | null>(null);
  const installmentContinueRef = useRef<(() => void) | null>(null);
  const confirmRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setCanContinueCard(false);
    setCanContinueInstallments(false);
    setIsConfirmPending(false);
  }, [currentStep]);

  const bindings = useMemo<CheckoutHostBindings>(
    () => ({
      cardContinueRef,
      installmentContinueRef,
      confirmRef,
      onCanContinueCardChange: setCanContinueCard,
      onCanContinueInstallmentsChange: setCanContinueInstallments,
      onConfirmPendingChange: setIsConfirmPending,
    }),
    [],
  );

  const actions = useMemo((): CheckoutHostActions | null => {
    if (isLoadingRequirements || requirementsError) {
      return null;
    }

    const base = {
      currentStep,
      canGoBack,
      onBack: goBack,
      primaryPending: false as boolean,
    };

    switch (currentStep) {
      case "cpf":
        return {
          ...base,
          primaryLabel: "Continuar",
          primaryDisabled: false,
          onPrimary: () => requestFormSubmit(CPF_STEP_FORM_ID),
        };
      case "phone":
        return {
          ...base,
          primaryLabel: "Continuar",
          primaryDisabled: false,
          onPrimary: () => requestFormSubmit(PHONE_STEP_FORM_ID),
        };
      case "card":
        return {
          ...base,
          primaryLabel: "Continuar",
          primaryDisabled: !canContinueCard,
          onPrimary: () => cardContinueRef.current?.(),
        };
      case "installments":
        return {
          ...base,
          primaryLabel: "Continuar",
          primaryDisabled: !canContinueInstallments,
          onPrimary: () => installmentContinueRef.current?.(),
        };
      case "confirmation":
        return {
          ...base,
          primaryLabel: "Confirmar pagamento",
          primaryDisabled: !clearsaleSessionId,
          primaryPending: isConfirmPending,
          onPrimary: () => confirmRef.current?.(),
        };
      default:
        return null;
    }
  }, [
    isLoadingRequirements,
    requirementsError,
    currentStep,
    canGoBack,
    goBack,
    canContinueCard,
    canContinueInstallments,
    clearsaleSessionId,
    isConfirmPending,
  ]);

  return { actions, bindings };
}
