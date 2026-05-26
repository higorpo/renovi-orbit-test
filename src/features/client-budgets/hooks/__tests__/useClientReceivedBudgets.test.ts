// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClientReceivedBudgets } from "../useClientReceivedBudgets";
import * as clientBudgetsApi from "../../api/clientBudgets.api";

vi.mock("../../api/clientBudgets.api", () => ({
  fetchClientReceivedBudgets: vi.fn(),
}));

const fetchClientReceivedBudgets = vi.mocked(clientBudgetsApi.fetchClientReceivedBudgets);

function makePage(overrides: Partial<{ page: number; total_count: number; page_size: number }> = {}) {
  return {
    items: [{ service_request_id: "sr-1" } as never],
    total_count: overrides.total_count ?? 25,
    page: overrides.page ?? 1,
    page_size: overrides.page_size ?? 20,
  };
}

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useClientReceivedBudgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchClientReceivedBudgets.mockResolvedValue({
      data: makePage(),
      error: null,
    });
  });

  it("loads and flattens pages", async () => {
    const { result } = renderHook(
      () => useClientReceivedBudgets({ status: "awaiting_decision", search: null }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalCount).toBe(25);
    expect(fetchClientReceivedBudgets).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      status: "awaiting_decision",
      search: null,
    });
  });

  it("surfaces API error", async () => {
    fetchClientReceivedBudgets.mockResolvedValue({ data: null, error: "fail" });

    const { result } = renderHook(
      () => useClientReceivedBudgets({ status: null, search: "x" }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("surfaces error when data is null and error message is missing", async () => {
    fetchClientReceivedBudgets.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(
      () => useClientReceivedBudgets({ status: null, search: null }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("does not fetch next page on last page", async () => {
    fetchClientReceivedBudgets.mockResolvedValue({
      data: {
        items: [{ service_request_id: "a" } as never],
        total_count: 20,
        page: 1,
        page_size: 20,
      },
      error: null,
    });

    const { result } = renderHook(
      () => useClientReceivedBudgets({ status: null, search: null }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("fetches next page when available", async () => {
    fetchClientReceivedBudgets
      .mockResolvedValueOnce({
        data: makePage({ page: 1, total_count: 40, page_size: 20 }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ service_request_id: "sr-2" } as never],
          total_count: 40,
          page: 2,
          page_size: 20,
        },
        error: null,
      });

    const { result } = renderHook(
      () => useClientReceivedBudgets({ status: null, search: null }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
  });
});
