import { describe, expect, it } from "vitest";
import { getClientPaymentHistoryAmounts } from "../clientPaymentHistoryAmounts";

describe("getClientPaymentHistoryAmounts", () => {
  it("returns paid amount only when there is no refund", () => {
    expect(
      getClientPaymentHistoryAmounts({
        amountPaid: 633.7,
        refundedAmount: null,
        refundedAt: null,
      }),
    ).toEqual({
      originalAmount: 633.7,
      netAmount: 633.7,
      refundedAmount: null,
      showRefundBreakdown: false,
      isRefundPending: false,
    });
  });

  it("ignores zero refund amounts", () => {
    expect(
      getClientPaymentHistoryAmounts({
        amountPaid: 633.7,
        refundedAmount: 0,
        refundedAt: null,
      }),
    ).toEqual({
      originalAmount: 633.7,
      netAmount: 633.7,
      refundedAmount: null,
      showRefundBreakdown: false,
      isRefundPending: false,
    });
  });

  it("computes net and refund for confirmed partial refund", () => {
    expect(
      getClientPaymentHistoryAmounts({
        amountPaid: 633.7,
        refundedAmount: 540,
        refundedAt: "2026-07-02T12:00:00.000Z",
      }),
    ).toEqual({
      originalAmount: 633.7,
      netAmount: 93.7,
      refundedAmount: 540,
      showRefundBreakdown: true,
      isRefundPending: false,
    });
  });

  it("marks refund as pending when amount exists without refundedAt", () => {
    expect(
      getClientPaymentHistoryAmounts({
        amountPaid: 633.7,
        refundedAmount: 633.7,
        refundedAt: null,
      }),
    ).toEqual({
      originalAmount: 633.7,
      netAmount: 0,
      refundedAmount: 633.7,
      showRefundBreakdown: true,
      isRefundPending: true,
    });
  });

  it("computes zero net for full confirmed refund", () => {
    expect(
      getClientPaymentHistoryAmounts({
        amountPaid: 633.7,
        refundedAmount: 633.7,
        refundedAt: "2026-07-02T12:00:00.000Z",
      }),
    ).toEqual({
      originalAmount: 633.7,
      netAmount: 0,
      refundedAmount: 633.7,
      showRefundBreakdown: true,
      isRefundPending: false,
    });
  });
});
