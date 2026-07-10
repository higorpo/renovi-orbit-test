import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCheckoutStepper } from "../../hooks/useCheckoutStepper";
import type { CheckoutContext, CheckoutStepId } from "../../types/checkoutStepper.types";
import { mapCheckoutStepperError } from "../../utils/mapCheckoutStepperError";
import { CheckoutStepContent } from "./CheckoutStepContent";

export type CheckoutStepperRenderProps = ReturnType<typeof useCheckoutStepper>;

export type CheckoutStepperProps = {
  enabled?: boolean;
  proposalId?: string;
  serviceId?: string;
  chatId?: string | null;
  /** @deprecated Use proposalId */
  providerServiceId?: string;
  checkoutContext?: CheckoutContext;
  onCheckoutSuccess?: (contractedServiceId: string) => void;
  renderStep?: (
    step: CheckoutStepId,
    stepper: CheckoutStepperRenderProps,
  ) => ReactNode;
};

const STEPS_WITH_OWN_NAV: CheckoutStepId[] = [
  "cpf",
  "phone",
  "card",
  "installments",
  "confirmation",
];

export function CheckoutStepper({
  enabled = true,
  proposalId,
  serviceId,
  chatId = null,
  providerServiceId,
  checkoutContext,
  onCheckoutSuccess,
  renderStep,
}: CheckoutStepperProps) {
  const resolvedProposalId = proposalId ?? providerServiceId;
  const stepper = useCheckoutStepper({ enabled });

  if (stepper.isLoadingRequirements) {
    return (
      <div
        data-testid="checkout-stepper-loading"
        className="flex items-center justify-center gap-2 py-8 text-muted-foreground"
      >
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span>Carregando checkout…</span>
      </div>
    );
  }

  if (stepper.requirementsError) {
    return (
      <div
        data-testid="checkout-stepper-error"
        className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        role="alert"
      >
        {mapCheckoutStepperError(stepper.requirementsError)}
      </div>
    );
  }

  const stepContent = renderStep
    ? renderStep(stepper.currentStep, stepper)
    : (
      <CheckoutStepContent
        stepper={stepper}
        proposalId={resolvedProposalId}
        serviceId={serviceId}
        chatId={chatId}
        checkoutContext={checkoutContext}
        onCheckoutSuccess={onCheckoutSuccess}
      />
    );

  const showGenericNav = !STEPS_WITH_OWN_NAV.includes(stepper.currentStep);

  return (
    <div data-testid="checkout-stepper" className="space-y-4">
      {stepContent}

      {showGenericNav ? (
        <div className="flex justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={stepper.goBack}
            disabled={!stepper.canGoBack}
          >
            Voltar
          </Button>
          <Button
            type="button"
            onClick={stepper.goNext}
            disabled={!stepper.canGoNext}
          >
            Continuar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
