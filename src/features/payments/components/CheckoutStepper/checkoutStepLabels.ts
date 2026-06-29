import type { CheckoutStepId } from "../../types/checkoutStepper.types";

export const CHECKOUT_STEP_LABELS: Record<CheckoutStepId, string> = {
  cpf: "CPF",
  phone: "Telefone",
  card: "Cartão",
  installments: "Parcelas",
  confirmation: "Confirmação",
};
