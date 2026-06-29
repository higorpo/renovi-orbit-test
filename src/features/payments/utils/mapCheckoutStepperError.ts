const CHECKOUT_STEPPER_ERROR_MESSAGES: Record<string, string> = {
  invalid_checkout_step_requirements_response:
    "Não foi possível carregar as etapas do checkout. Tente novamente.",
  checkout_step_requirements_unavailable:
    "Não foi possível carregar as etapas do checkout. Tente novamente.",
};

export function mapCheckoutStepperError(code: string | null | undefined): string {
  if (!code) {
    return "Não foi possível carregar as etapas do checkout. Tente novamente.";
  }

  return CHECKOUT_STEPPER_ERROR_MESSAGES[code] ?? code;
}
