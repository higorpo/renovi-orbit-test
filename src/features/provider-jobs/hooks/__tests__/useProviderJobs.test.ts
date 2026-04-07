import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderJobs } from "../useProviderJobs";
import * as providerJobsApi from "../../api/providerJobs.api";

vi.mock("../../api/providerJobs.api", () => ({
  fetchProviderJobs: vi.fn(),
}));

vi.mock("@/lib/sentry", () => ({
  Sentry: {
    startSpan: vi.fn((_opts: unknown, fn: (span: { setAttribute: () => void } | null) => unknown) =>
      fn({ setAttribute: vi.fn() }),
    ),
  },
}));

const fetchProviderJobs = vi.mocked(providerJobsApi.fetchProviderJobs);

function makePage(overrides: Partial<{ page: number; total_count: number }> = {}) {
  return {
    items: [{ id: "j1" } as never],
    total_count: overrides.total_count ?? 25,
    page: overrides.page ?? 1,
    page_size: 20,
    provider_services: [],
    provider_area_summary: { cities: ["Florianópolis"], neighborhoods: ["Centro"] },
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

  it("does not fetch when coordinates are missing", () => {
    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: null,
          longitude: null,
          radiusKm: 10,
          serviceId: null,
          sortMode: "nearest",
        }),
      { wrapper: wrapper() },
    );

    expect(result.current.isLoading).toBe(false);
    expect(fetchProviderJobs).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });

  it("fetches first page and flattens items", async () => {
    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: -27.5,
          longitude: -48.5,
          radiusKm: 10,
          serviceId: null,
          sortMode: "nearest",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchProviderJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: -27.5,
        longitude: -48.5,
        page: 1,
      }),
    );
    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalCount).toBe(25);
    expect(result.current.providerAreaSummary.cities).toContain("Florianópolis");
  });

  it("exposes hasNextPage and fetchNextPage when more pages exist", async () => {
    fetchProviderJobs
      .mockResolvedValueOnce({
        data: makePage({ page: 1, total_count: 45 }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: { ...makePage({ page: 2, total_count: 45 }), items: [{ id: "j2" } as never] },
        error: null,
      });

    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: -1,
          longitude: -1,
          radiusKm: 5,
          serviceId: "svc",
          sortMode: "newest",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(1));
  });

  it("sets isError when API returns error", async () => {
    fetchProviderJobs.mockResolvedValue({ data: null, error: "fail" });

    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: -1,
          longitude: -1,
          radiusKm: 10,
          serviceId: null,
          sortMode: "nearest",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("throws when API returns neither data nor error", async () => {
    fetchProviderJobs.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: -1,
          longitude: -1,
          radiusKm: 10,
          serviceId: null,
          sortMode: "nearest",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("does not paginate when total_count is not finite", async () => {
    fetchProviderJobs.mockResolvedValue({
      data: { ...makePage({ page: 1 }), total_count: Number.NaN } as never,
      error: null,
    });

    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: -1,
          longitude: -1,
          radiusKm: 10,
          serviceId: null,
          sortMode: "nearest",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("does not offer another page when total fits in one page", async () => {
    fetchProviderJobs.mockResolvedValue({
      data: makePage({ total_count: 15, page: 1 }),
      error: null,
    });

    const { result } = renderHook(
      () =>
        useProviderJobs({
          latitude: -1,
          longitude: -1,
          radiusKm: 10,
          serviceId: null,
          sortMode: "nearest",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
  });
});
