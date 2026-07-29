import type { ClientPaymentTransaction } from "../types/paymentHistory.types";

export type ClientPaymentHistoryAmounts = {
  originalAmount: number;
  netAmount: number;
  refundedAmount: number | null;
  showRefundBreakdown: boolean;
  /** True when amount is known but gateway credit is not confirmed yet. */
  isRefundPending: boolean;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Derives display amounts for client payment history rows with refunds. */
export function getClientPaymentHistoryAmounts(
  transaction: Pick<
    ClientPaymentTransaction,
    "amountPaid" | "refundedAmount" | "refundedAt"
  >,
): ClientPaymentHistoryAmounts {
  const refundedAmount =
    transaction.refundedAmount != null && transaction.refundedAmount > 0
      ? roundCurrency(transaction.refundedAmount)
      : null;

  if (refundedAmount == null) {
    return {
      originalAmount: transaction.amountPaid,
      netAmount: transaction.amountPaid,
      refundedAmount: null,
      showRefundBreakdown: false,
      isRefundPending: false,
    };
  }

  const isRefundPending = transaction.refundedAt == null;

  return {
    originalAmount: transaction.amountPaid,
    netAmount: roundCurrency(Math.max(0, transaction.amountPaid - refundedAmount)),
    refundedAmount,
    showRefundBreakdown: true,
    isRefundPending,
  };
}
