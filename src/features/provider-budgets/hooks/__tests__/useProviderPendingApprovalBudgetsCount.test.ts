// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderPendingApprovalBudgetsCount } from "../useProviderPendingApprovalBudgetsCount";
import * as providerBudgetsApi from "../../api/providerBudgets.api";

vi.mock("../../api/providerBudgets.api", () => ({
  fetchProviderSentBudgets: vi.fn(),
}));

const fetchProviderSentBudgets = vi.mocked(providerBudgetsApi.fetchProviderSentBudgets);

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useProviderPendingApprovalBudgetsCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns total_count from first page with submitted status", async () => {
    fetchProviderSentBudgets.mockResolvedValue({
      data: {
        items: [],
        total_count: 5,
        page: 1,
        page_size: 1,
      },
      error: null,
    });

    const { result } = renderHook(() => useProviderPendingApprovalBudgetsCount(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.count).toBe(5);
    expect(fetchProviderSentBudgets).toHaveBeenCalledWith({
      page: 1,
      pageSize: 1,
      status: "submitted",
      search: null,
    });
  });

  it("isError when API fails", async () => {
    fetchProviderSentBudgets.mockResolvedValue({ data: null, error: "err" });

    const { result } = renderHook(() => useProviderPendingApprovalBudgetsCount(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
