import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProviderJobs, fetchProviderProposalJobDetail } from "../providerJobs.api";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    rpc: mocks.rpc,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const logger = await import("@/lib/logger").then((m) => m.logger);

describe("fetchProviderJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns data when invoke succeeds", async () => {
    const payload = {
      items: [],
      total_count: 0,
      page: 1,
      page_size: 20,
      provider_services: [],
      provider_area_summary: { cities: [], neighborhoods: [] },
    };
    mocks.invoke.mockResolvedValue({ data: payload, error: null } as never);

    const result = await fetchProviderJobs({
      latitude: -27.5,
      longitude: -48.5,
      radius_km: 10,
      service_id: null,
      sort_mode: "nearest",
      page: 1,
      page_size: 20,
    });

    expect(mocks.invoke).toHaveBeenCalledWith("match-provider-jobs", {
      body: expect.objectContaining({
        latitude: -27.5,
        longitude: -48.5,
      }),
    });
    expect(result).toEqual({ data: payload, error: null });
  });

  it("returns error when invoke reports transport error", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { message: "Network down" },
    } as never);

    const result = await fetchProviderJobs({
      latitude: -27.5,
      longitude: -48.5,
      radius_km: 10,
      service_id: null,
      sort_mode: "nearest",
      page: 1,
      page_size: 20,
    });

    expect(result.data).toBeNull();
    expect(result.error).toBe("Network down");
    expect(logger.error).toHaveBeenCalledWith(
      "fetch_provider_jobs_error",
      expect.objectContaining({ error: "Network down" }),
    );
  });

  it("returns error when response body contains error field", async () => {
    mocks.invoke.mockResolvedValue({
      data: { error: "Invalid sort mode" },
      error: null,
    } as never);

    const result = await fetchProviderJobs({
      latitude: -27.5,
      longitude: -48.5,
      radius_km: 10,
      service_id: null,
      sort_mode: "nearest",
      page: 1,
      page_size: 20,
    });

    expect(result.data).toBeNull();
    expect(result.error).toBe("Invalid sort mode");
    expect(logger.error).toHaveBeenCalledWith(
      "fetch_provider_jobs_api_error",
      expect.objectContaining({ error: "Invalid sort mode" }),
    );
  });
});

describe("fetchProviderProposalJobDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls rpc with proposal id when proposalId is set", async () => {
    const job = { id: "job-1" };
    mocks.rpc.mockResolvedValue({ data: job, error: null } as never);

    const result = await fetchProviderProposalJobDetail({
      proposalId: "prop-1",
      serviceRequestId: "sr-ignored",
      latitude: -27,
      longitude: -48,
      radiusKm: 15,
    });

    expect(mocks.rpc).toHaveBeenCalledWith("get_provider_proposal_job_detail", {
      p_proposal_id: "prop-1",
      p_service_request_id: undefined,
      p_lat: -27,
      p_lng: -48,
      p_radius_km: 15,
    });
    expect(result).toEqual({ data: job, error: null });
  });

  it("calls rpc with service request id when proposalId is null", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: "j" }, error: null } as never);

    await fetchProviderProposalJobDetail({
      proposalId: null,
      serviceRequestId: "sr-99",
      latitude: 1,
      longitude: 2,
    });

    expect(mocks.rpc).toHaveBeenCalledWith("get_provider_proposal_job_detail", {
      p_proposal_id: undefined,
      p_service_request_id: "sr-99",
      p_lat: 1,
      p_lng: 2,
      p_radius_km: 10,
    });
  });

  it("returns error and logs when rpc fails", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "RPC failed" },
    } as never);

    const result = await fetchProviderProposalJobDetail({
      proposalId: null,
      serviceRequestId: "sr-1",
      latitude: 0,
      longitude: 0,
    });

    expect(result.data).toBeNull();
    expect(result.error).toBe("RPC failed");
    expect(logger.error).toHaveBeenCalledWith(
      "fetch_provider_proposal_job_detail_error",
      expect.objectContaining({ error: "RPC failed" }),
    );
  });

  it("returns null data when rpc returns no row", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null } as never);

    const result = await fetchProviderProposalJobDetail({
      proposalId: null,
      serviceRequestId: "sr-x",
      latitude: -1,
      longitude: -2,
    });

    expect(result).toEqual({ data: null, error: null });
  });
});
