import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClientBudgetDetail } from "../useClientBudgetDetail";
import * as clientBudgetsApi from "../../api/clientBudgets.api";

vi.mock("../../api/clientBudgets.api", () => ({
  fetchClientBudgetDetail: vi.fn(),
}));

const fetchClientBudgetDetail = vi.mocked(clientBudgetsApi.fetchClientBudgetDetail);

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useClientBudgetDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when serviceRequestId is null", () => {
    const { result } = renderHook(() => useClientBudgetDetail(null), { wrapper: wrapper() });
    expect(fetchClientBudgetDetail).not.toHaveBeenCalled();
    expect(result.current.detail).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("returns detail on success", async () => {
    const detail = {
      service_request: { title: "T", status: "open" },
      budgets: [],
      questions: [],
    } as never;
    fetchClientBudgetDetail.mockResolvedValue({ data: detail, error: null });

    const { result } = renderHook(() => useClientBudgetDetail("sr-1"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.detail).toEqual(detail);
  });

  it("marks error when API returns error string", async () => {
    fetchClientBudgetDetail.mockResolvedValue({ data: null, error: "missing" });

    const { result } = renderHook(() => useClientBudgetDetail("sr-1"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
