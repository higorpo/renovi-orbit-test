import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClientPendingQuestionsCount } from "../useClientPendingQuestionsCount";
import * as clientBudgetsApi from "../../api/clientBudgets.api";

vi.mock("../../api/clientBudgets.api", () => ({
  fetchClientBudgetQuestions: vi.fn(),
}));

const fetchClientBudgetQuestions = vi.mocked(clientBudgetsApi.fetchClientBudgetQuestions);

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useClientPendingQuestionsCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns total_count from first page", async () => {
    fetchClientBudgetQuestions.mockResolvedValue({
      data: {
        items: [],
        total_count: 7,
        page: 1,
        page_size: 1,
      },
      error: null,
    });

    const { result } = renderHook(() => useClientPendingQuestionsCount(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.count).toBe(7);
    expect(fetchClientBudgetQuestions).toHaveBeenCalledWith({
      page: 1,
      pageSize: 1,
      questionStatus: "pending",
      search: null,
    });
  });

  it("isError when API fails", async () => {
    fetchClientBudgetQuestions.mockResolvedValue({ data: null, error: "err" });

    const { result } = renderHook(() => useClientPendingQuestionsCount(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("isError when data is missing and error is null", async () => {
    fetchClientBudgetQuestions.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useClientPendingQuestionsCount(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
