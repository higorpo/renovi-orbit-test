import { formatCalendarDate } from "@/lib/utils/calendarDate";
import type { SettlementMovement } from "../types/settlements.types";

const MOVEMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Previsto",
  PAID_OUT: "Liquidado",
};

export function formatSettlementMovementStatus(status: string): string {
  return MOVEMENT_STATUS_LABELS[status] ?? status;
}

export function formatSettlementDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return formatCalendarDate(value);
}

export function formatSettlementSettledLabel(item: SettlementMovement): string {
  const settled = formatSettlementDate(item.settledAt);
  if (settled) {
    return `Liquidado em ${settled}`;
  }
  if (item.movementStatus === "PAID_OUT") {
    return "Liquidado";
  }
  return "Pendente";
}

export function formatSettlementInstallmentLabel(installment: number | null): string | null {
  if (installment == null || installment < 1) return null;
  return `Parcela ${installment}`;
}

export function isSettlementDebit(item: SettlementMovement): boolean {
  return item.recordType === "DEBIT" || item.isRefundClawback;
}
