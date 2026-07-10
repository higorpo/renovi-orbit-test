import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchProviderJobs,
  isInvalidProviderJobsCursorError,
} from "../providerJobs.api";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  Sentry: {
    startSpan: (_ctx: unknown, fn: () => unknown) => fn(),
  },
}));

const logger = await import("@/lib/logger").then((m) => m.logger);

describe("fetchProviderJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes list-provider-opportunities", async () => {
    const payload = {
      items: [{ service_request_id: "job-1" }],
      next_cursor: "cursor-abc",
      has_more: true,
    };
    mocks.invoke.mockResolvedValue({ data: payload, error: null } as never);

    const result = await fetchProviderJobs({
      sort_mode: "nearest",
      cursor: null,
      limit: 20,
      lat: -27.5,
      lng: -48.5,
    });

    expect(mocks.invoke).toHaveBeenCalledWith("list-provider-opportunities", {
      body: {
        sort_mode: "nearest",
        cursor: null,
        limit: 20,
        lat: -27.5,
        lng: -48.5,
      },
    });
    expect(result).toEqual({ data: payload, error: null });
  });

  it("clamps limit to FEED_MAX_LIMIT", async () => {
    mocks.invoke.mockResolvedValue({
      data: { items: [], next_cursor: null, has_more: false },
      error: null,
    } as never);

    await fetchProviderJobs({
      sort_mode: "newest",
      limit: 999,
    });

    expect(mocks.invoke).toHaveBeenCalledWith("list-provider-opportunities", {
      body: expect.objectContaining({ limit: 50 }),
    });
  });

  it("returns error when invoke reports transport error", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { message: "Network down" },
    } as never);

    const result = await fetchProviderJobs({
      sort_mode: "newest",
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
      data: { error: "Invalid feed cursor" },
      error: null,
    } as never);

    const result = await fetchProviderJobs({
      sort_mode: "newest",
      cursor: "bad-cursor",
    });

    expect(result.data).toBeNull();
    expect(result.error).toBe("Invalid feed cursor");
    expect(isInvalidProviderJobsCursorError(result.error)).toBe(true);
  });

  it("uses data.message when error field is not a string", async () => {
    mocks.invoke.mockResolvedValue({
      data: { error: { code: "X" }, message: "Upstream failed" },
      error: null,
    } as never);

    const result = await fetchProviderJobs({ sort_mode: "newest" });

    expect(result).toEqual({ data: null, error: "Upstream failed" });
  });

  it("falls back to generic message when error payload has no string message", async () => {
    mocks.invoke.mockResolvedValue({
      data: { error: { code: "X" }, message: 42 },
      error: null,
    } as never);

    const result = await fetchProviderJobs({ sort_mode: "newest" });

    expect(result).toEqual({
      data: null,
      error: "Failed to fetch opportunities",
    });
  });

  it("defaults missing items and cursor fields on success payload", async () => {
    mocks.invoke.mockResolvedValue({
      data: { has_more: 1 },
      error: null,
    } as never);

    const result = await fetchProviderJobs({ sort_mode: "newest" });

    expect(result).toEqual({
      data: {
        items: [],
        next_cursor: null,
        has_more: true,
      },
      error: null,
    });
  });

  it("uses FEED_DEFAULT_LIMIT when limit is missing or non-finite", async () => {
    mocks.invoke.mockResolvedValue({
      data: { items: [], next_cursor: null, has_more: false },
      error: null,
    } as never);

    await fetchProviderJobs({ sort_mode: "newest", limit: Number.NaN });
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      "list-provider-opportunities",
      expect.objectContaining({
        body: expect.objectContaining({ limit: 20 }),
      }),
    );

    await fetchProviderJobs({ sort_mode: "newest" });
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      "list-provider-opportunities",
      expect.objectContaining({
        body: expect.objectContaining({ limit: 20 }),
      }),
    );
  });

  it("clamps limit to at least 1 after truncation", async () => {
    mocks.invoke.mockResolvedValue({
      data: { items: [], next_cursor: null, has_more: false },
      error: null,
    } as never);

    await fetchProviderJobs({ sort_mode: "newest", limit: 0.4 });

    expect(mocks.invoke).toHaveBeenCalledWith(
      "list-provider-opportunities",
      expect.objectContaining({
        body: expect.objectContaining({ limit: 1 }),
      }),
    );
  });

  it("treats null error as not an invalid cursor", () => {
    expect(isInvalidProviderJobsCursorError(null)).toBe(false);
  });
});
