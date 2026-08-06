// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePublicProviderRatings } from "../usePublicProviderRatings";
import * as ratingsApi from "../../api/providerProfileRatings.api";

vi.mock("../../api/providerProfileRatings.api", () => ({
  listPublicProviderRatings: vi.fn(),
}));

const listPublicProviderRatings = vi.mocked(
  ratingsApi.listPublicProviderRatings,
);

function makePage(
  overrides: Partial<{
    items: { id: string; overall_score: number; comment: string | null; submitted_at: string }[];
    next_cursor: { submitted_at: string; id: string } | null;
    has_more: boolean;
  }> = {},
) {
  return {
    items: overrides.items ?? [
      {
        id: "r1",
        overall_score: 5,
        comment: "Bom",
        submitted_at: "2026-08-01T00:00:00Z",
      },
    ],
    next_cursor: overrides.next_cursor ?? null,
    has_more: overrides.has_more ?? false,
  };
}

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("usePublicProviderRatings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPublicProviderRatings.mockResolvedValue({
      data: makePage(),
      error: null,
    });
  });

  it("does not fetch when providerId is empty", () => {
    renderHook(() => usePublicProviderRatings("  "), { wrapper: wrapper() });
    expect(listPublicProviderRatings).not.toHaveBeenCalled();
  });

  it("fetches first page with null cursor", async () => {
    const { result } = renderHook(() => usePublicProviderRatings("pid-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listPublicProviderRatings).toHaveBeenCalledWith({
      providerId: "pid-1",
      pageSize: 20,
      cursor: null,
    });
    expect(result.current.items).toHaveLength(1);
  });

  it("paginates with next_cursor as pageParam", async () => {
    const cursor = { submitted_at: "2026-08-01T00:00:00Z", id: "r1" };
    listPublicProviderRatings
      .mockResolvedValueOnce({
        data: makePage({ next_cursor: cursor, has_more: true }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: makePage({
          items: [
            {
              id: "r2",
              overall_score: 4,
              comment: null,
              submitted_at: "2026-07-01T00:00:00Z",
            },
          ],
          next_cursor: null,
          has_more: false,
        }),
        error: null,
      });

    const { result } = renderHook(() => usePublicProviderRatings("pid-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(listPublicProviderRatings).toHaveBeenLastCalledWith({
      providerId: "pid-1",
      pageSize: 20,
      cursor,
    });
    expect(result.current.hasNextPage).toBe(false);
  });

  it("sets isError when API fails", async () => {
    listPublicProviderRatings.mockResolvedValue({
      data: null,
      error: "fail",
    });

    const { result } = renderHook(() => usePublicProviderRatings("pid-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
