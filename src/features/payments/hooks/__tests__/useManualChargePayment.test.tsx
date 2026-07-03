// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as chargesApi from "../../api/charges.api";
import { useManualChargePayment } from "../useManualChargePayment";

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

describe("useManualChargePayment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns charge outcome on success", async () => {
    vi.spyOn(chargesApi, "manualChargePayment").mockResolvedValue({
      data: {
        scheduleId: "sched-1",
        outcome: "PAID",
        chargeAmount: "1024.29",
      },
      error: null,
    });

    const { result } = renderHook(() => useManualChargePayment(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        scheduleId: "sched-1",
        clearsaleSessionId: "session-1",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      scheduleId: "sched-1",
      outcome: "PAID",
      chargeAmount: "1024.29",
    });
  });

  it("throws with errorCode when manual charge fails", async () => {
    vi.spyOn(chargesApi, "manualChargePayment").mockResolvedValue({
      data: null,
      error: "Muitas tentativas",
      errorCode: "RATE_LIMIT_EXCEEDED",
      status: 429,
    });

    const { result } = renderHook(() => useManualChargePayment(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          scheduleId: "sched-1",
          clearsaleSessionId: "session-1",
        });
      }),
    ).rejects.toThrow("Muitas tentativas");
  });
});
