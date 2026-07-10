import { Loader2 } from "lucide-react";
import type { CheckoutHostBindings } from "../../hooks/useCheckoutHostActions";
import type { UseCheckoutStepperResult } from "../../hooks/useCheckoutStepper";
import type { CheckoutContext } from "../../types/checkoutStepper.types";
import { mapCheckoutStepperError } from "../../utils/mapCheckoutStepperError";
import { CheckoutStepContent } from "./CheckoutStepContent";

export type CheckoutStepperProps = {
  stepper: UseCheckoutStepperResult;
  hostBindings: CheckoutHostBindings;
  proposalId?: string;
  serviceId?: string;
  chatId?: string | null;
  checkoutContext?: CheckoutContext;
  onCheckoutSuccess?: (contractedServiceId: string) => void;
};

/**
 * Checkout body: loading / error / current step.
 * Host owns useCheckoutStepper + useCheckoutHostActions (footer actions).
 */
export function CheckoutStepper({
  stepper,
  hostBindings,
  proposalId,
  serviceId,
  chatId = null,
  checkoutContext,
  onCheckoutSuccess,
}: CheckoutStepperProps) {
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

  return (
    <div data-testid="checkout-stepper" className="space-y-4">
      <CheckoutStepContent
        stepper={stepper}
        hostBindings={hostBindings}
        proposalId={proposalId}
        serviceId={serviceId}
        chatId={chatId}
        checkoutContext={checkoutContext}
        onCheckoutSuccess={onCheckoutSuccess}
      />
    </div>
  );
}
