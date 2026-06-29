export function formatManualPaymentFailureMessage(
  failureReason: string | null,
  failureCode: string | null,
): string {
  if (failureReason?.trim()) {
    return failureReason.trim();
  }

  switch (failureCode) {
    case "CARD_DECLINED":
      return "Seu cartão foi recusado. Tente outro cartão ou entre em contato com o emissor.";
    case "INSUFFICIENT_FUNDS":
      return "Saldo insuficiente no cartão. Tente outro cartão.";
    default:
      return "Não foi possível concluir o pagamento. Verifique os dados do cartão e tente novamente.";
  }
}

export function isTerminalManualChargeOutcome(outcome: string): boolean {
  return outcome === "FAILED" || outcome === "FAILED_PERMANENT";
}
