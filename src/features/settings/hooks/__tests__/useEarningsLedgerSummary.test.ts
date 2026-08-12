// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEarningsLedgerSummary } from "../useEarningsLedgerSummary";

const mocks = vi.hoisted(() => ({
  receivables: {
    data: [] as Array<{ amountReceivedAtCapture: number; netAmountReceived: number }>,
    isLoading: false,
    isError: false,
  },
  settlements: {
    totalCount: 0,
    isLoading: false,
    isError: false,
  },
}));

vi.mock("@/features/payments", () => ({
  useProviderPaymentHistory: () => mocks.receivables,
  summarizeProviderReceivables: (
    items: Array<{ amountReceivedAtCapture: number; netAmountReceived: number }>,
  ) => {
    const agreedTotal = items.reduce((sum, item) => sum + item.amountReceivedAtCapture, 0);
    const netTotal = items.reduce((sum, item) => sum + item.netAmountReceived, 0);
    return {
      agreedTotal,
      netTotal,
      count: items.length,
      hasClawback: agreedTotal !== netTotal,
    };
  },
}));

vi.mock("@/features/provider-earnings", () => ({
  useProviderSettlements: () => mocks.settlements,
}));

describe("useEarningsLedgerSummary", () => {
  beforeEach(() => {
    mocks.receivables.data = [];
    mocks.receivables.isLoading = false;
    mocks.receivables.isError = false;
    mocks.settlements.totalCount = 0;
    mocks.settlements.isLoading = false;
    mocks.settlements.isError = false;
  });

  it("summarizes capture totals and deposit count", () => {
    mocks.receivables.data = [
      { amountReceivedAtCapture: 1000, netAmountReceived: 800 },
    ];
    mocks.settlements.totalCount = 4;

    const { result } = renderHook(() => useEarningsLedgerSummary());

    expect(result.current.agreedTotal).toBe(1000);
    expect(result.current.netTotal).toBe(800);
    expect(result.current.hasClawback).toBe(true);
    expect(result.current.depositCount).toBe(4);
  });
});
