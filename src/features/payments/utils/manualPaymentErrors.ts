import { mapPaymentUserMessage } from "./mapPaymentUserMessage";

export function formatManualPaymentFailureMessage(
  _failureReason: string | null,
  failureCode: string | null,
): string {
  return mapPaymentUserMessage(failureCode, {
    fallback:
      "Não foi possível concluir o pagamento. Verifique os dados do cartão e tente novamente.",
  });
}

export function isTerminalManualChargeOutcome(outcome: string): boolean {
  return outcome === "FAILED" || outcome === "FAILED_PERMANENT";
}
