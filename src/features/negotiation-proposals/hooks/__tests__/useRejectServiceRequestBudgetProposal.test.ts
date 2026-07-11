// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY } from "../../constants/queryKeys";
import { useRejectServiceRequestBudgetProposal } from "../useRejectServiceRequestBudgetProposal";

const rejectProposalMock = vi.fn();

vi.mock("../../api/serviceRequestBudgetCompare.api", () => ({
  rejectServiceRequestBudgetProposal: (...args: unknown[]) => rejectProposalMock(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  return {
    invalidateQueries,
    wrapper: function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useRejectServiceRequestBudgetProposal", () => {
  it("rejects the proposal and refreshes the active budget comparison", async () => {
    rejectProposalMock.mockResolvedValue({ data: { success: true }, error: null });
    const { wrapper, invalidateQueries } = createWrapper();
    const { result } = renderHook(
      () => useRejectServiceRequestBudgetProposal("request-1"),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        proposalId: "proposal-1",
        reason: "Schedule does not work",
      });
    });

    expect(rejectProposalMock).toHaveBeenCalledWith({
      proposalId: "proposal-1",
      reason: "Schedule does not work",
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Orçamento recusado. O prestador receberá seu motivo.",
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY, "request-1"],
      refetchType: "active",
    });
  });

  it("exposes the API error and does not invalidate on failure", async () => {
    rejectProposalMock.mockResolvedValue({ data: null, error: "Rejection failed" });
    const { wrapper, invalidateQueries } = createWrapper();
    const { result } = renderHook(
      () => useRejectServiceRequestBudgetProposal("request-1"),
      { wrapper },
    );

    await expect(
      result.current.mutateAsync({ proposalId: "proposal-1", reason: "No" }),
    ).rejects.toThrow("Rejection failed");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Rejection failed"),
    );
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
