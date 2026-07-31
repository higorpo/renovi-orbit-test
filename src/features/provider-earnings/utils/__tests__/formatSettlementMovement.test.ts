import { describe, expect, it } from "vitest";
import type { SettlementMovement } from "../../types/settlements.types";
import {
  formatSettlementDate,
  formatSettlementInstallmentLabel,
  formatSettlementMovementStatus,
  formatSettlementSettledLabel,
  isSettlementDebit,
} from "../formatSettlementMovement";

function makeItem(overrides: Partial<SettlementMovement> = {}): SettlementMovement {
  return {
    id: "m-1",
    paymentScheduleId: "sched-1",
    providerId: "prov-1",
    gatewaySlug: "netcred",
    gatewayPayoutId: "payout-1",
    gatewayMovementId: "mov-1",
    gatewayTransactionId: "tx-1",
    payoutStatus: null,
    movementStatus: "PENDING",
    movementType: "CARD_PAYMENT",
    movementSource: "TRANSACTION",
    recordType: "CREDIT",
    installment: 1,
    grossAmount: 100,
    netAmount: 95,
    baseSettleDate: "2026-06-15",
    settlingAt: "2026-06-15",
    settledAt: null,
    isAdvance: false,
    isRefundClawback: false,
    brand: null,
    bankAccountMask: null,
    syncSource: "webhook",
    syncedAt: "2026-06-01T00:00:00.000Z",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("formatSettlementMovement", () => {
  it("formats known and unknown statuses", () => {
    expect(formatSettlementMovementStatus("PENDING")).toBe("Previsto");
    expect(formatSettlementMovementStatus("PAID_OUT")).toBe("Liquidado");
    expect(formatSettlementMovementStatus("OTHER")).toBe("OTHER");
  });

  it("formats calendar dates via formatCalendarDate", () => {
    expect(formatSettlementDate("2026-06-15")).toBe("15/06/2026");
    expect(formatSettlementDate(null)).toBeNull();
  });

  it("formats settled label", () => {
    expect(formatSettlementSettledLabel(makeItem({ settledAt: "2026-07-01" }))).toContain(
      "Liquidado em",
    );
    expect(
      formatSettlementSettledLabel(makeItem({ movementStatus: "PAID_OUT", settledAt: null })),
    ).toBe("Liquidado");
    expect(formatSettlementSettledLabel(makeItem())).toBe("Pendente");
  });

  it("formats installment label", () => {
    expect(formatSettlementInstallmentLabel(2)).toBe("Parcela 2");
    expect(formatSettlementInstallmentLabel(null)).toBeNull();
    expect(formatSettlementInstallmentLabel(0)).toBeNull();
  });

  it("detects debit / clawback", () => {
    expect(isSettlementDebit(makeItem({ recordType: "DEBIT" }))).toBe(true);
    expect(isSettlementDebit(makeItem({ isRefundClawback: true }))).toBe(true);
    expect(isSettlementDebit(makeItem())).toBe(false);
  });
});
