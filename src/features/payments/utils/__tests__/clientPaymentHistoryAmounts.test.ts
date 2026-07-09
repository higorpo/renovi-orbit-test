import { describe, expect, it } from "vitest";
import { getClientPaymentHistoryAmounts } from "../clientPaymentHistoryAmounts";

describe("getClientPaymentHistoryAmounts", () => {
  it("returns paid amount only when there is no refund", () => {
    expect(
      getClientPaymentHistoryAmounts({ amountPaid: 633.7, refundedAmount: null }),
    ).toEqual({
      originalAmount: 633.7,
      netAmount: 633.7,
      refundedAmount: null,
      showRefundBreakdown: false,
    });
  });

  it("ignores zero refund amounts", () => {
    expect(
      getClientPaymentHistoryAmounts({ amountPaid: 633.7, refundedAmount: 0 }),
    ).toEqual({
      originalAmount: 633.7,
      netAmount: 633.7,
      refundedAmount: null,
      showRefundBreakdown: false,
    });
  });

  it("computes net and refund for partial refund", () => {
    expect(
      getClientPaymentHistoryAmounts({ amountPaid: 633.7, refundedAmount: 540 }),
    ).toEqual({
      originalAmount: 633.7,
      netAmount: 93.7,
      refundedAmount: 540,
      showRefundBreakdown: true,
    });
  });

  it("computes zero net for full refund", () => {
    expect(
      getClientPaymentHistoryAmounts({ amountPaid: 633.7, refundedAmount: 633.7 }),
    ).toEqual({
      originalAmount: 633.7,
      netAmount: 0,
      refundedAmount: 633.7,
      showRefundBreakdown: true,
    });
  });
});
