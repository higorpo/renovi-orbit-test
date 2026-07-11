// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getServiceRescheduleRequest: vi.fn(),
}));

vi.mock("../../api/serviceReschedule.api", () => apiMocks);

import { useRescheduleTimelineHydration } from "../useRescheduleTimelineHydration";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

describe("useRescheduleTimelineHydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stays idle when disabled or missing ids", () => {
    const { result } = renderHook(
      () => useRescheduleTimelineHydration("chat-1", null, true),
      { wrapper },
    );

    expect(result.current.snapshot).toBeNull();
    expect(apiMocks.getServiceRescheduleRequest).not.toHaveBeenCalled();
  });

  it("loads a reschedule snapshot when enabled", async () => {
    const snapshot = { id: "rr-1", status: "pending" };
    apiMocks.getServiceRescheduleRequest.mockResolvedValue({
      data: snapshot,
      error: null,
    });

    const { result } = renderHook(
      () => useRescheduleTimelineHydration("chat-1", "rr-1", true),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.snapshot).toEqual(snapshot);
    });
    expect(apiMocks.getServiceRescheduleRequest).toHaveBeenCalledWith("rr-1");
  });

  it("surfaces API errors", async () => {
    apiMocks.getServiceRescheduleRequest.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    const { result } = renderHook(
      () => useRescheduleTimelineHydration("chat-1", "rr-missing", true),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toMatch(/not found/);
  });
});
