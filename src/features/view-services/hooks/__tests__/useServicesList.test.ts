// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useServicesList } from "../useServicesList";

const listServicesMock = vi.fn();

vi.mock("../../api/services.api", () => ({
  listServices: (...args: unknown[]) => listServicesMock(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const baseParams = {
  statusTabId: "negotiation" as const,
  search: "",
  categoryId: null,
  cityName: null,
  neighborhoodName: null,
  dateFrom: null,
  dateTo: null,
  hasProposals: null,
  hasImages: null,
  serviceRequestId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useServicesList", () => {
  it("flattens pages and exposes total count", async () => {
    listServicesMock.mockResolvedValue({
      data: {
        items: [{ id: "sr-1" }],
        total_count: 1,
        page: 1,
        page_size: 20,
      },
      error: null,
    });

    const { result } = renderHook(() => useServicesList(baseParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([{ id: "sr-1" }]);
    expect(result.current.totalCount).toBe(1);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("throws when list API fails", async () => {
    listServicesMock.mockResolvedValue({ data: null, error: "boom" });

    const { result } = renderHook(() => useServicesList(baseParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("computes next page when more results remain", async () => {
    listServicesMock.mockResolvedValue({
      data: {
        items: [{ id: "sr-1" }],
        total_count: 40,
        page: 1,
        page_size: 20,
      },
      error: null,
    });

    const { result } = renderHook(() => useServicesList(baseParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    listServicesMock.mockResolvedValue({
      data: {
        items: [{ id: "sr-2" }],
        total_count: 40,
        page: 2,
        page_size: 20,
      },
      error: null,
    });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
  });

  it("can be disabled", () => {
    const { result } = renderHook(
      () => useServicesList({ ...baseParams, enabled: false }),
      { wrapper: createWrapper() },
    );
    expect(result.current.isLoading).toBe(false);
    expect(listServicesMock).not.toHaveBeenCalled();
  });

  it("exposes refetch helper", async () => {
    listServicesMock.mockResolvedValue({
      data: {
        items: [{ id: "sr-1" }],
        total_count: 1,
        page: 1,
        page_size: 20,
      },
      error: null,
    });

    const { result } = renderHook(() => useServicesList(baseParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(listServicesMock.mock.calls.length).toBeGreaterThan(1));
  });
});
