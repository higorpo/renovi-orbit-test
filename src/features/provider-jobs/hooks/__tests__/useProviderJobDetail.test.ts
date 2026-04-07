import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderJobDetail } from "../useProviderJobDetail";
import * as providerJobsApi from "../../api/providerJobs.api";
import * as useProviderLocationHook from "../useProviderLocation";

vi.mock("../../api/providerJobs.api", () => ({
  fetchProviderProposalJobDetail: vi.fn(),
}));

vi.mock("../useProviderLocation", () => ({
  useProviderLocation: vi.fn(),
}));

const fetchProviderProposalJobDetail = vi.mocked(
  providerJobsApi.fetchProviderProposalJobDetail,
);
const useProviderLocation = vi.mocked(useProviderLocationHook.useProviderLocation);

const baseJob = {
  id: "job-1",
  title: "Título",
} as never;

const expectedLocationArgs = {
  latitude: -27.5,
  longitude: -48.5,
  radiusKm: 10,
};

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
    fetchProviderProposalJobDetail.mockResolvedValue({
      data: baseJob,
      error: null,
    });
  });

  it("does not fetch without jobId", () => {
    const { result } = renderHook(() => useProviderJobDetail(undefined), {
      wrapper: wrapper(),
    });
    expect(fetchProviderProposalJobDetail).not.toHaveBeenCalled();
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

  it("loads job from get_provider_proposal_job_detail", async () => {
    const { result } = renderHook(() => useProviderJobDetail("job-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.job).toEqual(baseJob));
    expect(fetchProviderProposalJobDetail).toHaveBeenCalledWith({
      proposalId: null,
      serviceRequestId: "job-1",
      ...expectedLocationArgs,
    });
  });

  it("passes proposal id when initial job includes it", async () => {
    const initialJob = {
      id: "job-1",
      title: "Título",
      provider_proposal_id: "prop-1",
    } as never;
    const { result } = renderHook(
      () =>
        useProviderJobDetail("job-1", {
          initialJob,
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.job).toEqual(baseJob));
    expect(fetchProviderProposalJobDetail).toHaveBeenCalledWith({
      proposalId: "prop-1",
      serviceRequestId: "job-1",
      ...expectedLocationArgs,
    });
  });

  it("isError when fetch fails", async () => {
    fetchProviderProposalJobDetail.mockResolvedValue({ data: null, error: "nope" });
    const { result } = renderHook(() => useProviderJobDetail("job-1"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("uses Brazil centroid when provider location is unavailable", async () => {
    useProviderLocation.mockReturnValue({
      location: null,
      error: "x",
      isLoading: false,
      permissionDenied: false,
      insecureContext: false,
      isUsingDefault: true,
      retry: vi.fn(),
    });

    const { result } = renderHook(() => useProviderJobDetail("job-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.job).toEqual(baseJob));
    expect(fetchProviderProposalJobDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: -14.235,
        longitude: -51.9253,
      }),
    );
  });

  it("ignores initial job when its id does not match jobId", async () => {
    const wrongInitial = { id: "other", title: "Other" } as never;
    const { result } = renderHook(
      () =>
        useProviderJobDetail("job-1", {
          initialJob: wrongInitial,
        }),
      { wrapper: wrapper() },
    );

    expect(result.current.job).toBeNull();
    await waitFor(() => expect(result.current.job).toEqual(baseJob));
  });
});
