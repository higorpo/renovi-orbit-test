// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRecordProviderOpportunityView } from "./useRecordProviderOpportunityView";

const authMocks = vi.hoisted(() => ({
  profile: { role: "provider" as "provider" | "client" },
}));

const recordMock = vi.fn();

vi.mock("@/features/auth", () => ({
  useAuth: () => authMocks,
}));

vi.mock("../api/opportunityView.api", () => ({
  recordProviderOpportunityView: (...args: unknown[]) => recordMock(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn() },
}));

describe("useRecordProviderOpportunityView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.profile = { role: "provider" };
    recordMock.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("records view for providers on mount", async () => {
    renderHook(() => useRecordProviderOpportunityView("sr-1"));

    await waitFor(() =>
      expect(recordMock).toHaveBeenCalledWith("sr-1"),
    );
  });

  it("does not record for clients", async () => {
    authMocks.profile = { role: "client" };
    renderHook(() => useRecordProviderOpportunityView("sr-1"));

    await waitFor(() => expect(recordMock).not.toHaveBeenCalled());
  });

  it("records at most once per serviceRequestId per mount", async () => {
    const { rerender } = renderHook(
      ({ id }) => useRecordProviderOpportunityView(id),
      { initialProps: { id: "sr-1" } },
    );

    await waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1));
    rerender({ id: "sr-1" });
    expect(recordMock).toHaveBeenCalledTimes(1);
  });

  it("logs a warning when recording fails", async () => {
    const { logger } = await import("@/lib/logger");
    recordMock.mockRejectedValue(new Error("network"));

    renderHook(() => useRecordProviderOpportunityView("sr-fail"));

    await waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "record_provider_opportunity_view_failed",
        expect.objectContaining({ serviceRequestId: "sr-fail" }),
      );
    });
  });

  it("does nothing when serviceRequestId is missing", async () => {
    renderHook(() => useRecordProviderOpportunityView(undefined));
    await waitFor(() => expect(recordMock).not.toHaveBeenCalled());
  });
});
