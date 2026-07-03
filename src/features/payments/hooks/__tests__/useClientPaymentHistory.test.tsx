// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as historyApi from "../../api/history.api";
import { useClientPaymentHistory } from "../useClientPaymentHistory";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useClientPaymentHistory", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads client payment transactions", async () => {
    vi.spyOn(historyApi, "listClientPaymentTransactions").mockResolvedValue({
      data: [{
        scheduleId: "sched-1",
        contractedServiceId: "service-1",
        amountPaid: 1000,
        serviceAmount: 900,
        installmentNumber: 1,
        paidAt: "2026-07-01T12:00:00.000Z",
        refundedAmount: null,
        refundedAt: null,
        state: "PAID",
        isDisputed: false,
        createdAt: "2026-07-01T11:00:00.000Z",
      }],
      error: null,
    });

    const { result } = renderHook(() => useClientPaymentHistory(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.scheduleId).toBe("sched-1");
  });
});
