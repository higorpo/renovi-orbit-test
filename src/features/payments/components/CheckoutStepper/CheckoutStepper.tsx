import { ErrorState } from "@/components/ui/error-state";
import type { CheckoutHostBindings } from "../../hooks/useCheckoutHostActions";
import type { UseCheckoutStepperResult } from "../../hooks/useCheckoutStepper";
import type { CheckoutContext } from "../../types/checkoutStepper.types";
import { mapCheckoutStepperError } from "../../utils/mapCheckoutStepperError";
import { CheckoutStepContent } from "./CheckoutStepContent";
import { CheckoutStepperSkeleton } from "./CheckoutStepperSkeleton";

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
    return <CheckoutStepperSkeleton />;
  }

  if (stepper.requirementsError) {
    return (
      <ErrorState
        title="Não foi possível carregar o checkout"
        description={mapCheckoutStepperError(stepper.requirementsError)}
        onRetry={stepper.refetchRequirements}
        className="py-8"
      />
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
