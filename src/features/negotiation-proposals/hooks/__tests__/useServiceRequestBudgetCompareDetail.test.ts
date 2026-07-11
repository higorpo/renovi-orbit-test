// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useServiceRequestBudgetCompareDetail } from "../useServiceRequestBudgetCompareDetail";
import * as compareApi from "../../api/serviceRequestBudgetCompare.api";

vi.mock("../../api/serviceRequestBudgetCompare.api", () => ({
  fetchServiceRequestBudgetCompareDetail: vi.fn(),
}));

const fetchDetail = vi.mocked(compareApi.fetchServiceRequestBudgetCompareDetail);

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useServiceRequestBudgetCompareDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when serviceRequestId is null", () => {
    const { result } = renderHook(() => useServiceRequestBudgetCompareDetail(null), {
      wrapper: wrapper(),
    });
    expect(fetchDetail).not.toHaveBeenCalled();
    expect(result.current.detail).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("returns detail on success", async () => {
    const detail = {
      service_request: { title: "T", status: "open" },
      budgets: [],
    } as never;
    fetchDetail.mockResolvedValue({ data: detail, error: null });

    const { result } = renderHook(() => useServiceRequestBudgetCompareDetail("sr-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.detail).toEqual(detail);
  });

  it("surfaces API errors as query error state", async () => {
    fetchDetail.mockResolvedValue({ data: null, error: "boom" });

    const { result } = renderHook(() => useServiceRequestBudgetCompareDetail("sr-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.detail).toBeNull();
  });
});
