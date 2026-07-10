import type { CheckoutStepId } from "./checkoutStepper.types";

/** Footer actions exposed by checkout content for the host dialog/shell. */
export type CheckoutHostActions = {
  currentStep: CheckoutStepId;
  primaryLabel: string;
  primaryDisabled: boolean;
  primaryPending: boolean;
  onPrimary: () => void;
  canGoBack: boolean;
  onBack: () => void;
};
