import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderProposalHistory } from "../useProviderProposalHistory";
import * as providerProposalsApi from "../../api/providerProposals.api";

vi.mock("../../api/providerProposals.api", () => ({
  fetchProviderProposalHistory: vi.fn(),
}));

const fetchProviderProposalHistory = vi.mocked(
  providerProposalsApi.fetchProviderProposalHistory,
);

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useProviderProposalHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when disabled", () => {
    const { result } = renderHook(
      () => useProviderProposalHistory("sr-1", false),
      { wrapper: wrapper() },
    );
    expect(fetchProviderProposalHistory).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });

  it("returns items when enabled and API succeeds", async () => {
    const items = [{ id: "p1" } as never];
    fetchProviderProposalHistory.mockResolvedValue({ data: items, error: null });

    const { result } = renderHook(
      () => useProviderProposalHistory("sr-1", true),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.items).toEqual(items));
    expect(result.current.errorMessage).toBeNull();
  });

  it("surfaces error message when API returns error string", async () => {
    fetchProviderProposalHistory.mockResolvedValue({ data: [], error: "fail" });

    const { result } = renderHook(
      () => useProviderProposalHistory("sr-1", true),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).toBe("fail");
  });
});
