// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProposalHistory } from "../useProposalHistory";
import * as proposalsApi from "@/features/negotiation-proposals/api/proposals.api";

vi.mock("@/features/negotiation-proposals/api/proposals.api", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/negotiation-proposals/api/proposals.api")
  >();
  return {
    ...actual,
    fetchProviderProposalHistory: vi.fn(),
  };
});

const fetchProviderProposalHistory = vi.mocked(proposalsApi.fetchProviderProposalHistory);

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useProposalHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when disabled", () => {
    const { result } = renderHook(
      () => useProposalHistory("sr-1", false),
      { wrapper: wrapper() },
    );
    expect(fetchProviderProposalHistory).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });

  it("returns items when enabled and API succeeds", async () => {
    const items = [{ id: "p1" } as never];
    fetchProviderProposalHistory.mockResolvedValue({ data: items, error: null });

    const { result } = renderHook(
      () => useProposalHistory("sr-1", true),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.items).toEqual(items));
    expect(result.current.errorMessage).toBeNull();
  });

  it("surfaces error message when API returns error string", async () => {
    fetchProviderProposalHistory.mockResolvedValue({ data: [], error: "fail" });

    const { result } = renderHook(
      () => useProposalHistory("sr-1", true),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).toBe("fail");
  });
});
