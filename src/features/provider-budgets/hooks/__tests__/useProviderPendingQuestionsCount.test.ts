import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderPendingQuestionsCount } from "../useProviderPendingQuestionsCount";
import * as providerBudgetsApi from "../../api/providerBudgets.api";

vi.mock("../../api/providerBudgets.api", () => ({
  fetchProviderOwnQuestions: vi.fn(),
}));

const fetchProviderOwnQuestions = vi.mocked(providerBudgetsApi.fetchProviderOwnQuestions);

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useProviderPendingQuestionsCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns total_count from first page with pending filter", async () => {
    fetchProviderOwnQuestions.mockResolvedValue({
      data: {
        items: [],
        total_count: 7,
        page: 1,
        page_size: 1,
      },
      error: null,
    });

    const { result } = renderHook(() => useProviderPendingQuestionsCount(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.count).toBe(7);
    expect(fetchProviderOwnQuestions).toHaveBeenCalledWith({
      page: 1,
      pageSize: 1,
      questionStatus: "pending",
      search: null,
    });
  });

  it("isError when API fails", async () => {
    fetchProviderOwnQuestions.mockResolvedValue({ data: null, error: "err" });

    const { result } = renderHook(() => useProviderPendingQuestionsCount(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
