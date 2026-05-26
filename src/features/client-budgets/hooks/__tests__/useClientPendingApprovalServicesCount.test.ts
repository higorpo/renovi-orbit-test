// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClientPendingApprovalServicesCount } from "../useClientPendingApprovalServicesCount";
import * as clientBudgetsApi from "../../api/clientBudgets.api";

vi.mock("../../api/clientBudgets.api", () => ({
  fetchClientReceivedBudgets: vi.fn(),
}));

const fetchClientReceivedBudgets = vi.mocked(clientBudgetsApi.fetchClientReceivedBudgets);

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useClientPendingApprovalServicesCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns total_count from first page with awaiting_decision status", async () => {
    fetchClientReceivedBudgets.mockResolvedValue({
      data: {
        items: [],
        total_count: 3,
        page: 1,
        page_size: 1,
      },
      error: null,
    });

    const { result } = renderHook(() => useClientPendingApprovalServicesCount(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.count).toBe(3);
    expect(fetchClientReceivedBudgets).toHaveBeenCalledWith({
      page: 1,
      pageSize: 1,
      status: "awaiting_decision",
      search: null,
    });
  });

  it("isError when API fails", async () => {
    fetchClientReceivedBudgets.mockResolvedValue({ data: null, error: "err" });

    const { result } = renderHook(() => useClientPendingApprovalServicesCount(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("isError when data is missing and error is null", async () => {
    fetchClientReceivedBudgets.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useClientPendingApprovalServicesCount(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
