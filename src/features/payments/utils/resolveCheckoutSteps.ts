import type {
  CheckoutStepId,
  CheckoutStepRequirements,
} from "../types/checkoutStepper.types";

export function resolveCheckoutSteps(
  requirements: CheckoutStepRequirements,
): CheckoutStepId[] {
  const steps: CheckoutStepId[] = [];

  if (requirements.needs_cpf) {
    steps.push("cpf");
  }

  if (requirements.needs_phone) {
    steps.push("phone");
  }

  steps.push("card", "installments", "confirmation");

  return steps;
}
