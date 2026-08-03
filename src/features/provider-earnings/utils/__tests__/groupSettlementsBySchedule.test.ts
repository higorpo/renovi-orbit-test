import { describe, expect, it } from "vitest";
import type { SettlementMovement } from "../../types/settlements.types";
import { groupSettlementsBySchedule } from "../groupSettlementsBySchedule";

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
    serviceRequestId: null,
    serviceRequestTitle: null,
    ...overrides,
  };
}

describe("groupSettlementsBySchedule", () => {
  it("groups consecutive same schedule ids", () => {
    const groups = groupSettlementsBySchedule([
      makeItem({ id: "a", paymentScheduleId: "s1", installment: 1 }),
      makeItem({ id: "b", paymentScheduleId: "s1", installment: 2 }),
      makeItem({ id: "c", paymentScheduleId: "s2", installment: 1 }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].paymentScheduleId).toBe("s1");
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].items).toHaveLength(1);
  });

  it("does not merge non-consecutive same schedule", () => {
    const groups = groupSettlementsBySchedule([
      makeItem({ id: "a", paymentScheduleId: "s1" }),
      makeItem({ id: "b", paymentScheduleId: "s2" }),
      makeItem({ id: "c", paymentScheduleId: "s1" }),
    ]);

    expect(groups).toHaveLength(3);
  });

  it("keeps null schedule rows separate when consecutive", () => {
    const groups = groupSettlementsBySchedule([
      makeItem({ id: "a", paymentScheduleId: null }),
      makeItem({ id: "b", paymentScheduleId: null }),
    ]);

    expect(groups).toHaveLength(2);
  });
});
