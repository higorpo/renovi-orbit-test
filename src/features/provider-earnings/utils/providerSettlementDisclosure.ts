import {
  addCalendarDaysIso,
  formatLongDatePtBr,
  normalizeCalendarDateToIso,
  parseIsoDate,
} from "@/lib/utils/calendarDate";

const PROVIDER_BANK_SETTLEMENT_DAYS = 30;

export const PROVIDER_SETTLEMENT_COMPLETION_NOTE =
  "Marcar o serviço como concluído não antecipa quando o valor será depositado na sua conta.";

export function estimateProviderBankSettlementDate(capturePaidAt: string): Date | null {
  const paidIso = normalizeCalendarDateToIso(capturePaidAt);
  if (!paidIso) return null;

  return parseIsoDate(addCalendarDaysIso(paidIso, PROVIDER_BANK_SETTLEMENT_DAYS));
}

export function formatEstimatedBankReceiptDate(capturePaidAt: string): string | null {
  const paidIso = normalizeCalendarDateToIso(capturePaidAt);
  if (!paidIso) return null;

  return formatLongDatePtBr(addCalendarDaysIso(paidIso, PROVIDER_BANK_SETTLEMENT_DAYS));
}

export type FormatProviderSettlementDisclosureOptions = {
  /** Real Netcred settling_at when known; preferred over D+30 fallback. */
  settlingAt?: string | null;
};

export function formatProviderSettlementDisclosure(
  capturePaidAt: string,
  options?: FormatProviderSettlementDisclosureOptions,
): string | null {
  const settlingAt = options?.settlingAt?.trim();
  if (settlingAt) {
    const realIso = normalizeCalendarDateToIso(settlingAt);
    if (realIso) {
      return `Previsão de depósito na conta: ${formatLongDatePtBr(realIso)}`;
    }
  }

  const formattedDate = formatEstimatedBankReceiptDate(capturePaidAt);
  if (!formattedDate) {
    return null;
  }

  return `Previsão de depósito na conta: ${formattedDate}`;
}

export function formatProviderSettlementHoldDisclosure(
  reason: "refund" | "dispute" = "refund",
): string {
  if (reason === "dispute") {
    return "Há um chargeback em análise. A previsão de depósito fica suspensa até a resolução da disputa.";
  }

  return "Há um estorno em andamento. A previsão de depósito fica suspensa até a conclusão do reembolso.";
}
