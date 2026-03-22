import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderJobDetail } from "../useProviderJobDetail";
import * as providerJobsApi from "../../api/providerJobs.api";
import * as useProviderLocationHook from "../useProviderLocation";

vi.mock("../../api/providerJobs.api", () => ({
  fetchProviderJobs: vi.fn(),
}));

vi.mock("../useProviderLocation", () => ({
  useProviderLocation: vi.fn(),
}));

const fetchProviderJobs = vi.mocked(providerJobsApi.fetchProviderJobs);
const useProviderLocation = vi.mocked(useProviderLocationHook.useProviderLocation);

const baseJob = {
  id: "job-1",
  title: "Título",
} as never;

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useProviderJobDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProviderLocation.mockReturnValue({
      location: { latitude: -27.5, longitude: -48.5 },
      error: null,
      isLoading: false,
      permissionDenied: false,
      insecureContext: false,
      isUsingDefault: false,
      retry: vi.fn(),
    });
    fetchProviderJobs.mockResolvedValue({
      data: {
        items: [baseJob],
        total_count: 1,
        page: 1,
        page_size: 1,
        provider_services: [],
        provider_area_summary: { cities: [], neighborhoods: [] },
      },
      error: null,
    });
  });

  it("does not fetch without jobId", () => {
    const { result } = renderHook(() => useProviderJobDetail(undefined), {
      wrapper: wrapper(),
    });
    expect(fetchProviderJobs).not.toHaveBeenCalled();
    expect(result.current.job).toBeNull();
  });

  it("uses initial job as placeholder when ids match", () => {
    const { result } = renderHook(
      () =>
        useProviderJobDetail("job-1", {
          initialJob: baseJob as never,
        }),
      { wrapper: wrapper() },
    );
    expect(result.current.job).toEqual(baseJob);
  });

  it("loads job from API when location is ready", async () => {
    const { result } = renderHook(() => useProviderJobDetail("job-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.job).toEqual(baseJob));
    expect(fetchProviderJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        service_request_id: "job-1",
        page: 1,
        page_size: 1,
      }),
    );
  });

  it("isError when fetch fails", async () => {
    fetchProviderJobs.mockResolvedValue({ data: null, error: "nope" });
    const { result } = renderHook(() => useProviderJobDetail("job-1"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
