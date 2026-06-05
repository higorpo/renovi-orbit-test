import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProviderJobs } from "../providerJobs.api";

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
