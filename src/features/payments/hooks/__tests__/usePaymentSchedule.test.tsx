// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as chargesApi from "../../api/charges.api";
import { usePaymentSchedule } from "../usePaymentSchedule";

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

describe("usePaymentSchedule", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads schedule and contracted service context", async () => {
    vi.spyOn(chargesApi, "fetchPaymentScheduleByContractedService").mockResolvedValue({
      data: {
        id: "sched-1",
        contractedServiceId: "service-1",
        state: "FAILED",
        paymentTokenId: "tok-1",
        installmentNumber: 1,
        baseAmount: 1000,
        failureReason: null,
        failureCode: null,
        isDisputed: false,
        paidAt: null,
      },
      error: null,
    });
    vi.spyOn(chargesApi, "fetchContractedServicePaymentContext").mockResolvedValue({
      data: {
        acceptedProposalId: "proposal-1",
        serviceRequestId: "sr-1",
      },
      error: null,
    });

    const { result } = renderHook(
      () => usePaymentSchedule("service-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.schedule?.state).toBe("FAILED");
    expect(result.current.data?.context?.acceptedProposalId).toBe("proposal-1");
  });

  it("does not fetch when contractedServiceId is null", () => {
    const scheduleSpy = vi.spyOn(chargesApi, "fetchPaymentScheduleByContractedService");

    renderHook(() => usePaymentSchedule(null), { wrapper: createWrapper() });

    expect(scheduleSpy).not.toHaveBeenCalled();
  });
});
