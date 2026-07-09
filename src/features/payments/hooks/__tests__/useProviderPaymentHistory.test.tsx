// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as historyApi from "../../api/history.api";
import { useProviderPaymentHistory } from "../useProviderPaymentHistory";

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

describe("useProviderPaymentHistory", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads provider receivables", async () => {
    vi.spyOn(historyApi, "listProviderPaymentReceivables").mockResolvedValue({
      data: [{
        scheduleId: "sched-1",
        contractedServiceId: "service-1",
        amountReceivedAtCapture: 900,
        netAmountReceived: 850,
        receivedAt: "2026-07-01T12:00:00.000Z",
        refundedAmount: null,
        refundedAt: null,
        state: "PAID",
        isDisputed: false,
        createdAt: "2026-07-01T11:00:00.000Z",
      }],
      error: null,
    });

    const { result } = renderHook(() => useProviderPaymentHistory(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.[0]?.scheduleId).toBe("sched-1");
  });

  it("surfaces API errors", async () => {
    vi.spyOn(historyApi, "listProviderPaymentReceivables").mockResolvedValue({
      data: null,
      error: "history failed",
    });

    const { result } = renderHook(() => useProviderPaymentHistory(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
