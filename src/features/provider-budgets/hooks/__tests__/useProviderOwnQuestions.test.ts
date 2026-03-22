import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderOwnQuestions } from "../useProviderOwnQuestions";
import * as providerBudgetsApi from "../../api/providerBudgets.api";

vi.mock("../../api/providerBudgets.api", () => ({
  fetchProviderOwnQuestions: vi.fn(),
}));

const fetchProviderOwnQuestions = vi.mocked(providerBudgetsApi.fetchProviderOwnQuestions);

function makePage(overrides: Partial<{ page: number; total_count: number }> = {}) {
  return {
    items: [{ id: "q1" } as never],
    total_count: overrides.total_count ?? 5,
    page: overrides.page ?? 1,
    page_size: 20,
  };
}

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useProviderOwnQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProviderOwnQuestions.mockResolvedValue({
      data: makePage(),
      error: null,
    });
  });

  it("loads questions with filter params", async () => {
    const { result } = renderHook(
      () => useProviderOwnQuestions({ questionStatus: "answered", search: "foo" }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(fetchProviderOwnQuestions).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      questionStatus: "answered",
      search: "foo",
    });
  });

  it("marks error when API returns error", async () => {
    fetchProviderOwnQuestions.mockResolvedValue({ data: null, error: "nope" });

    const { result } = renderHook(
      () => useProviderOwnQuestions({ questionStatus: null, search: null }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("appends next page via fetchNextPage", async () => {
    fetchProviderOwnQuestions
      .mockResolvedValueOnce({
        data: makePage({ page: 1, total_count: 25 }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: { ...makePage({ page: 2, total_count: 25 }), page: 2 },
        error: null,
      });

    const { result } = renderHook(
      () => useProviderOwnQuestions({ questionStatus: null, search: null }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.items.length).toBeGreaterThanOrEqual(2));
  });
});
