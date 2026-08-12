import type { ProviderPaymentReceivable } from "../types/paymentHistory.types";

export type ProviderReceivablesSummary = {
  agreedTotal: number;
  netTotal: number;
  count: number;
  hasClawback: boolean;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Totals for the Ganhos ledger: agreed capture vs net after clawback. */
export function summarizeProviderReceivables(
  items: Pick<ProviderPaymentReceivable, "amountReceivedAtCapture" | "netAmountReceived">[],
): ProviderReceivablesSummary {
  const agreedTotal = roundCurrency(
    items.reduce((sum, item) => sum + item.amountReceivedAtCapture, 0),
  );
  const netTotal = roundCurrency(items.reduce((sum, item) => sum + item.netAmountReceived, 0));

  return {
    agreedTotal,
    netTotal,
    count: items.length,
    hasClawback: agreedTotal !== netTotal,
  };
}
