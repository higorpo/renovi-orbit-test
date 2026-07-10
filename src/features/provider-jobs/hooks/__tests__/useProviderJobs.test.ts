// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderJobs } from "../useProviderJobs";
import * as providerJobsApi from "../../api/providerJobs.api";
import { providerJobsListQueryKey } from "../../constants/queryKeys";

vi.mock("../../api/providerJobs.api", () => ({
  fetchProviderJobs: vi.fn(),
  isInvalidProviderJobsCursorError: vi.fn((error: string | null) =>
    Boolean(error?.includes("Invalid feed cursor")),
  ),
}));

const fetchProviderJobs = vi.mocked(providerJobsApi.fetchProviderJobs);

function makePage(overrides: Partial<{ next_cursor: string | null; has_more: boolean }> = {}) {
  return {
    items: [{ service_request_id: "j1" } as never],
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

describe("useProviderJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProviderJobs.mockResolvedValue({
      data: makePage(),
      error: null,
    });
  });

  it("does not fetch nearest sort when coordinates are missing", () => {
    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: null,
          longitude: null,
          sortMode: "nearest",
        }),
      { wrapper: wrapper() },
    );

    expect(result.current.isLoading).toBe(false);
    expect(fetchProviderJobs).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });

  it("fetches newest feed without coordinates", async () => {
    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: null,
          longitude: null,
          sortMode: "newest",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchProviderJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        sort_mode: "newest",
        cursor: null,
        lat: null,
        lng: null,
      }),
    );
    expect(result.current.items).toHaveLength(1);
    expect(result.current.loadedCount).toBe(1);
  });

  it("uses cursor query key with sort and optional coordinates", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapperWithClient = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);

    renderHook(
      () =>
        useProviderJobs({
          latitude: -27.5,
          longitude: -48.5,
          sortMode: "nearest",
        }),
      { wrapper: wrapperWithClient },
    );

    await waitFor(() => expect(fetchProviderJobs).toHaveBeenCalled());

    expect(
      client.getQueryCache().find({
        queryKey: providerJobsListQueryKey({
          sortMode: "nearest",
          lat: -27.5,
          lng: -48.5,
        }),
      }),
    ).toBeTruthy();
  });

  it("exposes hasNextPage and fetchNextPage when cursor has more", async () => {
    fetchProviderJobs
      .mockResolvedValueOnce({
        data: makePage({ next_cursor: "cursor-2", has_more: true }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: { items: [{ service_request_id: "j2" } as never], next_cursor: null, has_more: false },
        error: null,
      });

    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: -1,
          longitude: -1,
          sortMode: "newest",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.items.length).toBe(2));
    expect(fetchProviderJobs).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "cursor-2" }),
    );
  });

  it("sets isError when API returns error", async () => {
    fetchProviderJobs.mockResolvedValue({ data: null, error: "fail" });

    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: -1,
          longitude: -1,
          sortMode: "nearest",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("does not offer another page when has_more is false", async () => {
    fetchProviderJobs.mockResolvedValue({
      data: makePage({ has_more: false }),
      error: null,
    });

    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: -1,
          longitude: -1,
          sortMode: "newest",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("maps invalid cursor API errors to INVALID_PROVIDER_JOBS_CURSOR", async () => {
    fetchProviderJobs.mockResolvedValue({
      data: null,
      error: "Invalid feed cursor",
    });

    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: -1,
          longitude: -1,
          sortMode: "newest",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("INVALID_PROVIDER_JOBS_CURSOR");
  });

  it("uses generic error message when API returns null data without error string", async () => {
    fetchProviderJobs.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: -1,
          longitude: -1,
          sortMode: "newest",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Erro ao buscar trabalhos");
  });

  it("stops pagination when has_more is true but next_cursor is null", async () => {
    fetchProviderJobs.mockResolvedValue({
      data: makePage({ has_more: true, next_cursor: null }),
      error: null,
    });

    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: -1,
          longitude: -1,
          sortMode: "newest",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
  });
});
