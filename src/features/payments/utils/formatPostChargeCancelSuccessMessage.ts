/** Success toast copy for post-charge cancel + refund submit. */
export function formatPostChargeCancelSuccessMessage(expectedDays?: string): string {
  const windowLabel = formatStatementWindow(expectedDays);
  return `Cancelamento solicitado. O estorno pode levar de ${windowLabel} dias para aparecer na fatura.`;
}

function formatStatementWindow(expectedDays?: string): string {
  if (!expectedDays?.trim()) {
    return "30 a 60";
  }
  const trimmed = expectedDays.trim();
  return trimmed.includes("-") ? trimmed.replace("-", " a ") : trimmed;
}
