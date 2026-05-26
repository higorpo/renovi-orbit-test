// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClientRejectBudgetProposal } from "../useClientRejectBudgetProposal";
import * as clientBudgetsApi from "../../api/clientBudgets.api";

vi.mock("../../api/clientBudgets.api", () => ({
  rejectClientBudgetProposal: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const rejectClientBudgetProposal = vi.mocked(clientBudgetsApi.rejectClientBudgetProposal);

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useClientRejectBudgetProposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rejectClientBudgetProposal.mockResolvedValue({ error: null, data: { ok: true } });
  });

  it("calls API and invalidates caches on success", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useClientRejectBudgetProposal("sr-1"), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children),
    });

    act(() => {
      result.current.mutate({ proposalId: "p1", reason: "Motivo" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rejectClientBudgetProposal).toHaveBeenCalledWith({
      proposalId: "p1",
      reason: "Motivo",
    });
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["client-budget-detail", "sr-1"] }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["client-received-budgets"] }),
    );
  });

  it("surfaces API error via toast", async () => {
    rejectClientBudgetProposal.mockResolvedValue({ error: "Falhou", data: null });
    const { toast } = await import("sonner");

    const { result } = renderHook(() => useClientRejectBudgetProposal("sr-1"), {
      wrapper: wrapper(),
    });

    act(() => {
      result.current.mutate({ proposalId: "p1", reason: "x" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Falhou");
  });
});
