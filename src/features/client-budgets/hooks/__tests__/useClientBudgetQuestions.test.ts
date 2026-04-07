import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClientBudgetQuestions } from "../useClientBudgetQuestions";
import * as clientBudgetsApi from "../../api/clientBudgets.api";

vi.mock("../../api/clientBudgets.api", () => ({
  fetchClientBudgetQuestions: vi.fn(),
}));

const fetchClientBudgetQuestions = vi.mocked(clientBudgetsApi.fetchClientBudgetQuestions);

function makePage(overrides: Partial<{ page: number; total_count: number }> = {}) {
  return {
    items: [{ service_request_id: "q-1" } as never],
    total_count: overrides.total_count ?? 10,
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

describe("useClientBudgetQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchClientBudgetQuestions.mockResolvedValue({
      data: makePage(),
      error: null,
    });
  });

  it("loads questions with filters", async () => {
    const { result } = renderHook(
      () => useClientBudgetQuestions({ questionStatus: "pending", search: "limpeza" }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(fetchClientBudgetQuestions).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      questionStatus: "pending",
      search: "limpeza",
    });
  });

  it("marks error when API fails", async () => {
    fetchClientBudgetQuestions.mockResolvedValue({ data: null, error: "nope" });

    const { result } = renderHook(
      () => useClientBudgetQuestions({ questionStatus: "answered", search: null }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("marks error when API returns null data without error string", async () => {
    fetchClientBudgetQuestions.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(
      () => useClientBudgetQuestions({ questionStatus: null, search: null }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("fetches next page when more pages exist", async () => {
    fetchClientBudgetQuestions
      .mockResolvedValueOnce({
        data: {
          items: [{ service_request_id: "a" } as never],
          total_count: 40,
          page: 1,
          page_size: 20,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ service_request_id: "b" } as never],
          total_count: 40,
          page: 2,
          page_size: 20,
        },
        error: null,
      });

    const { result } = renderHook(
      () => useClientBudgetQuestions({ questionStatus: null, search: null }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
  });
});
