// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as checkoutApi from "../../api/checkout.api";
import { useProposalCheckoutContext } from "../useProposalCheckoutContext";

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

describe("useProposalCheckoutContext", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads checkout context for a proposal", async () => {
    vi.spyOn(checkoutApi, "getProposalCheckoutContext").mockResolvedValue({
      data: {
        proposalId: "prop-1",
        serviceRequestId: "service-1",
        providerId: "provider-1",
        proposedAmount: 1000,
        pricingSignature: "sig-1",
      },
      error: null,
    });

    const { result } = renderHook(
      () => useProposalCheckoutContext("prop-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.proposalId).toBe("prop-1");
  });

  it("stays disabled without proposalId", () => {
    const spy = vi.spyOn(checkoutApi, "getProposalCheckoutContext");
    renderHook(() => useProposalCheckoutContext(null), { wrapper: createWrapper() });
    expect(spy).not.toHaveBeenCalled();
  });

  it("throws when API returns an error", async () => {
    vi.spyOn(checkoutApi, "getProposalCheckoutContext").mockResolvedValue({
      data: null,
      error: "context failed",
    });

    const { result } = renderHook(
      () => useProposalCheckoutContext("prop-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("context failed");
  });
});
