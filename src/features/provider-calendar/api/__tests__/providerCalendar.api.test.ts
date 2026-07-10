import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProviderScheduledServices } from "../providerCalendar.api";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const logger = await import("@/lib/logger").then((m) => m.logger);

describe("fetchProviderScheduledServices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps RPC rows into scheduled service items", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        items: [
          {
            service_request_id: "sr-1",
            contracted_service_id: "cs-1",
            title: "Pintura",
            platform_service_title: "Pintor",
            platform_service_color_key: "blue",
            scheduled_start_date: "2026-06-10",
            scheduled_end_date: "2026-06-12",
            scheduled_shift: "morning",
            status: "PENDING_PAYMENT",
          },
        ],
        range_from: "2026-06-08",
        range_to: "2026-06-21",
        has_more_before: true,
        has_more_after: false,
      },
      error: null,
    });

    const result = await fetchProviderScheduledServices("2026-06-08", "2026-06-21");

    expect(mocks.rpc).toHaveBeenCalledWith("list_provider_scheduled_services", {
      p_from_date: "2026-06-08",
      p_to_date: "2026-06-21",
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      items: [
        {
          serviceRequestId: "sr-1",
          contractedServiceId: "cs-1",
          title: "Pintura",
          platformServiceTitle: "Pintor",
          platformServiceColorKey: "blue",
          scheduledStartDate: "2026-06-10",
          scheduledEndDate: "2026-06-12",
          scheduledShift: "morning",
          status: "PENDING_PAYMENT",
        },
      ],
      rangeFrom: "2026-06-08",
      rangeTo: "2026-06-21",
      hasMoreBefore: true,
      hasMoreAfter: false,
    });
  });

  it("treats missing items array as empty list", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        range_from: "2026-06-08",
        range_to: "2026-06-21",
        has_more_before: false,
        has_more_after: false,
      },
      error: null,
    });

    const result = await fetchProviderScheduledServices("2026-06-08", "2026-06-21");
    expect(result.error).toBeNull();
    expect(result.data?.items).toEqual([]);
  });

  it("returns error when RPC fails", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "rpc failed" },
    });

    const result = await fetchProviderScheduledServices("2026-06-08", "2026-06-21");

    expect(logger.error).toHaveBeenCalledWith(
      "provider_calendar_fetch_failed",
      expect.objectContaining({ fromDate: "2026-06-08", toDate: "2026-06-21" }),
    );
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("rpc failed");
  });

  it("returns error when RPC payload is empty", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    const result = await fetchProviderScheduledServices("2026-06-08", "2026-06-21");

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Empty calendar response");
  });
});
