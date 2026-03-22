import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderSentBudgets } from "../useProviderSentBudgets";
import * as providerBudgetsApi from "../../api/providerBudgets.api";

vi.mock("../../api/providerBudgets.api", () => ({
  fetchProviderSentBudgets: vi.fn(),
}));

const fetchProviderSentBudgets = vi.mocked(providerBudgetsApi.fetchProviderSentBudgets);

function makePage(overrides: Partial<{ page: number; total_count: number; page_size: number }> = {}) {
  return {
    items: [{ id: "b1" } as never],
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

describe("useProviderSentBudgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProviderSentBudgets.mockResolvedValue({
      data: makePage(),
      error: null,
    });
  });

  it("loads first page and flattens items", async () => {
    const { result } = renderHook(
      () => useProviderSentBudgets({ status: "submitted", search: null }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalCount).toBe(25);
    expect(fetchProviderSentBudgets).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      status: "submitted",
      search: null,
    });
  });

  it("marks error when API returns error", async () => {
    fetchProviderSentBudgets.mockResolvedValue({ data: null, error: "fail" });

    const { result } = renderHook(
      () => useProviderSentBudgets({ status: null, search: "x" }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("does not request another page when already on last page", async () => {
    fetchProviderSentBudgets.mockResolvedValue({
      data: {
        items: [{ id: "x" } as never],
        total_count: 20,
        page: 1,
        page_size: 20,
      },
      error: null,
    });

    const { result } = renderHook(
      () => useProviderSentBudgets({ status: null, search: null }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("fetches next page when within total pages", async () => {
    fetchProviderSentBudgets
      .mockResolvedValueOnce({
        data: makePage({ page: 1, total_count: 40, page_size: 20 }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: makePage({ page: 2, total_count: 40, page_size: 20 }),
        error: null,
      });

    const { result } = renderHook(
      () => useProviderSentBudgets({ status: null, search: null }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(fetchProviderSentBudgets).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 20,
      status: null,
      search: null,
    });
  });
});
