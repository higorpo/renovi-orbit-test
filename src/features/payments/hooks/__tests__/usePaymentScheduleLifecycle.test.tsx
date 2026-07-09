// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as chargesApi from "../../api/charges.api";
import { usePaymentScheduleLifecycle } from "../usePaymentScheduleLifecycle";

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

describe("usePaymentScheduleLifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads lifecycle for a contracted service", async () => {
    vi.spyOn(chargesApi, "fetchPaymentScheduleLifecycleByContractedService").mockResolvedValue({
      data: {
        contractedServiceId: "service-1",
        state: "AUTHORIZED",
        chargeScheduledAt: "2026-07-10T12:00:00.000Z",
        baseAmount: null,
        paidAmount: null,
      },
      error: null,
    });

    const { result } = renderHook(
      () => usePaymentScheduleLifecycle("service-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.contractedServiceId).toBe("service-1");
  });

  it("does not fetch without contractedServiceId", () => {
    const spy = vi.spyOn(chargesApi, "fetchPaymentScheduleLifecycleByContractedService");
    renderHook(() => usePaymentScheduleLifecycle(null), { wrapper: createWrapper() });
    expect(spy).not.toHaveBeenCalled();
  });

  it("throws when API fails", async () => {
    vi.spyOn(chargesApi, "fetchPaymentScheduleLifecycleByContractedService").mockResolvedValue({
      data: null,
      error: "lifecycle failed",
    });

    const { result } = renderHook(
      () => usePaymentScheduleLifecycle("service-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
