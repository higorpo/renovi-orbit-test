// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderCalendarMonth } from "../useProviderCalendarMonth";
import * as providerCalendarApi from "../../api/providerCalendar.api";

vi.mock("../../api/providerCalendar.api", () => ({
  fetchProviderScheduledServices: vi.fn(),
}));

vi.mock("@/lib/utils/calendarDate", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils/calendarDate")>(
    "@/lib/utils/calendarDate",
  );
  return {
    ...actual,
    todayCalendarIso: () => "2026-06-15",
  };
});

const fetchProviderScheduledServices = vi.mocked(
  providerCalendarApi.fetchProviderScheduledServices,
);

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useProviderCalendarMonth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProviderScheduledServices.mockResolvedValue({
      data: {
        items: [
          {
            serviceRequestId: "sr-1",
            contractedServiceId: "cs-1",
            title: "Pintura",
            platformServiceTitle: "Pintor",
            platformServiceColorKey: "blue",
            scheduledStartDate: "2026-06-10",
            scheduledEndDate: "2026-06-10",
            scheduledShift: "morning",
            status: "PENDING_PAYMENT",
          },
        ],
        rangeFrom: "2026-06-01",
        rangeTo: "2026-06-30",
        hasMoreBefore: false,
        hasMoreAfter: false,
      },
      error: null,
    });
  });

  it("does not fetch when disabled", () => {
    renderHook(() => useProviderCalendarMonth(false), { wrapper: wrapper() });
    expect(fetchProviderScheduledServices).not.toHaveBeenCalled();
  });

  it("loads the current month range and exposes services", async () => {
    const { result } = renderHook(() => useProviderCalendarMonth(true), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchProviderScheduledServices).toHaveBeenCalledWith("2026-06-01", "2026-06-30");
    expect(result.current.year).toBe(2026);
    expect(result.current.monthIndex).toBe(5);
    expect(result.current.services).toHaveLength(1);
    expect(result.current.weeks.length).toBeGreaterThan(0);
    expect(result.current.monthLabel.toLowerCase()).toContain("2026");
  });

  it("navigates across year boundaries and back to today", async () => {
    const { result } = renderHook(() => useProviderCalendarMonth(true), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    for (let i = 0; i < 6; i += 1) {
      act(() => {
        result.current.goToPreviousMonth();
      });
    }
    expect(result.current.year).toBe(2025);
    expect(result.current.monthIndex).toBe(11);

    act(() => {
      result.current.goToNextMonth();
    });
    expect(result.current.year).toBe(2026);
    expect(result.current.monthIndex).toBe(0);

    for (let i = 0; i < 12; i += 1) {
      act(() => {
        result.current.goToNextMonth();
      });
    }
    expect(result.current.year).toBe(2027);
    expect(result.current.monthIndex).toBe(0);

    act(() => {
      result.current.goToToday();
    });
    expect(result.current.year).toBe(2026);
    expect(result.current.monthIndex).toBe(5);
  });

  it("surfaces query errors", async () => {
    fetchProviderScheduledServices.mockResolvedValue({
      data: null,
      error: new Error("boom"),
    });

    const { result } = renderHook(() => useProviderCalendarMonth(true), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("throws when API returns empty data without error", async () => {
    fetchProviderScheduledServices.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useProviderCalendarMonth(true), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
