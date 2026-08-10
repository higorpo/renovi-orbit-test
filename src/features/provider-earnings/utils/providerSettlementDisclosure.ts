import {
  addCalendarDaysIso,
  formatLongDatePtBr,
  normalizeCalendarDateToIso,
  parseIsoDate,
} from "@/lib/utils/calendarDate";

const PROVIDER_BANK_SETTLEMENT_DAYS = 30;

/** Refund-related schedule states that suspend bank deposit estimate. */
const REFUND_HOLD_SCHEDULE_STATES = new Set([
  "REFUND_REQUESTED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

export const PROVIDER_SETTLEMENT_COMPLETION_NOTE =
  "Marcar o serviço como concluído não antecipa quando o valor será depositado na sua conta.";

/** Hold reasons for provider bank deposit disclosure (single slot in UI). */
export type ProviderSettlementHoldReason = "refund" | "dispute" | "service_dispute";

export type ResolveProviderSettlementHoldInput = {
  isDisputed: boolean;
  scheduleState: string;
  /** contracted_services.status — IN_DISPUTE triggers service_dispute hold. */
  contractedServiceStatus?: string | null;
};

export type ResolveProviderSettlementHoldResult = {
  settlementOnHold: boolean;
  holdReason: ProviderSettlementHoldReason;
};

/**
 * Resolves whether settlement disclosure is on hold and which copy to show.
 * UI has one holdReason: chargeback (is_disputed) > service_dispute (CS IN_DISPUTE) > refund.
 */
export function resolveProviderSettlementHold(
  input: ResolveProviderSettlementHoldInput,
): ResolveProviderSettlementHoldResult {
  const isRefundHold = REFUND_HOLD_SCHEDULE_STATES.has(input.scheduleState);
  const isServiceDispute = input.contractedServiceStatus === "IN_DISPUTE";
  const settlementOnHold = input.isDisputed || isServiceDispute || isRefundHold;

  let holdReason: ProviderSettlementHoldReason = "refund";
  if (input.isDisputed) {
    holdReason = "dispute";
  } else if (isServiceDispute) {
    holdReason = "service_dispute";
  }

  return { settlementOnHold, holdReason };
}

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
  reason: ProviderSettlementHoldReason = "refund",
): string {
  if (reason === "dispute") {
    return "Há um chargeback em análise. A previsão de depósito fica suspensa até a resolução da disputa.";
  }

  if (reason === "service_dispute") {
    return "Há uma disputa de serviço em andamento. A previsão de depósito fica suspensa até a resolução.";
  }

  return "Há um estorno em andamento. A previsão de depósito fica suspensa até a conclusão do reembolso.";
}
