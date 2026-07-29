const PAYMENT_HISTORY_STATE_LABELS: Record<string, string> = {
  PAID: "Pago",
  REFUNDED: "Reembolsado",
  PARTIALLY_REFUNDED: "Reembolso parcial",
  REFUND_REQUESTED: "Reembolso solicitado / em processamento",
};

export function formatPaymentHistoryState(state: string): string {
  return PAYMENT_HISTORY_STATE_LABELS[state] ?? state;
}

export function formatPaymentHistoryDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
