const PROVIDER_BANK_SETTLEMENT_DAYS = 30;

export const PROVIDER_SETTLEMENT_COMPLETION_NOTE =
  "Marcar o serviço como concluído não antecipa quando o valor será depositado na sua conta.";

export function estimateProviderBankSettlementDate(capturePaidAt: string): Date | null {
  const paidAt = new Date(capturePaidAt);
  if (Number.isNaN(paidAt.getTime())) {
    return null;
  }

  const estimated = new Date(paidAt);
  estimated.setUTCDate(estimated.getUTCDate() + PROVIDER_BANK_SETTLEMENT_DAYS);
  return estimated;
}

export function formatEstimatedBankReceiptDate(capturePaidAt: string): string | null {
  const estimated = estimateProviderBankSettlementDate(capturePaidAt);
  if (!estimated) {
    return null;
  }

  return estimated.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatProviderSettlementDisclosure(capturePaidAt: string): string | null {
  const formattedDate = formatEstimatedBankReceiptDate(capturePaidAt);
  if (!formattedDate) {
    return null;
  }

  return `Previsão de depósito na conta: ${formattedDate}`;
}
