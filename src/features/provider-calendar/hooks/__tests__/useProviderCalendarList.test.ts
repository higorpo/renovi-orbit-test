// @vitest-environment happy-dom
import { act, cleanup, render, renderHook, waitFor, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderCalendarList } from "../useProviderCalendarList";
import * as providerCalendarApi from "../../api/providerCalendar.api";
import { addCalendarDaysIso } from "@/lib/utils/calendarDate";
import type { ScheduledServiceItem, ScheduledServicesRangeResult } from "../../types/provider-calendar.types";

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

type ObserverCallback = IntersectionObserverCallback;

const observerState = vi.hoisted(() => ({
  instances: [] as { callback: ObserverCallback; observe: ReturnType<typeof vi.fn> }[],
}));

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function makeRangeResult(
  overrides: Partial<ScheduledServicesRangeResult> = {},
): ScheduledServicesRangeResult {
  return {
    items: overrides.items ?? [],
    rangeFrom: overrides.rangeFrom ?? "2026-06-08",
    rangeTo: overrides.rangeTo ?? "2026-06-21",
    hasMoreBefore: overrides.hasMoreBefore ?? false,
    hasMoreAfter: overrides.hasMoreAfter ?? false,
  };
}

const sampleService: ScheduledServiceItem = {
  serviceRequestId: "sr-1",
  contractedServiceId: "cs-1",
  title: "Pintura",
  platformServiceTitle: "Pintor",
  platformServiceColorKey: "blue",
  scheduledStartDate: "2026-06-15",
  scheduledEndDate: "2026-06-15",
  scheduledShift: "morning",
  status: "PENDING_PAYMENT",
};

function ListHarness({ enabled }: { enabled: boolean }) {
  const list = useProviderCalendarList(enabled);
  return createElement(
    "main",
    null,
    createElement("div", {
      ref: list.topSentinelRef,
      "data-testid": "top-sentinel",
    }),
    createElement("div", {
      "data-testid": "status",
      "data-loading": String(list.isLoading),
      "data-error": String(list.isError),
      "data-days": String(list.days.length),
      "data-today": list.today,
    }),
    createElement("div", {
      ref: list.bottomSentinelRef,
      "data-testid": "bottom-sentinel",
    }),
  );
}

describe("useProviderCalendarList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observerState.instances = [];

    class MockIntersectionObserver {
      callback: ObserverCallback;
      target: Element | null = null;
      observe = vi.fn((node: Element) => {
        this.target = node;
      });
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = () => [];
      root = null;
      rootMargin = "";
      thresholds: number[] = [];

      constructor(callback: ObserverCallback) {
        this.callback = callback;
        observerState.instances.push({ callback, observe: this.observe });
      }
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    fetchProviderScheduledServices.mockResolvedValue({
      data: makeRangeResult({
        items: [sampleService],
        hasMoreBefore: true,
        hasMoreAfter: true,
      }),
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not fetch when disabled", () => {
    const client = createClient();
    renderHook(() => useProviderCalendarList(false), { wrapper: wrapperFor(client) });
    expect(fetchProviderScheduledServices).not.toHaveBeenCalled();
  });

  it("loads the initial range and groups days around today", async () => {
    const client = createClient();
    render(createElement(ListHarness, { enabled: true }), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() =>
      expect(screen.getByTestId("status").getAttribute("data-loading")).toBe("false"),
    );

    expect(fetchProviderScheduledServices).toHaveBeenCalledWith("2026-06-08", "2026-06-28");
    expect(screen.getByTestId("status").getAttribute("data-today")).toBe("2026-06-15");
    expect(Number(screen.getByTestId("status").getAttribute("data-days"))).toBeGreaterThan(0);
  });

  it("fetches next page when bottom sentinel intersects", async () => {
    fetchProviderScheduledServices
      .mockResolvedValueOnce({
        data: makeRangeResult({
          rangeFrom: "2026-06-08",
          rangeTo: "2026-06-21",
          hasMoreBefore: true,
          hasMoreAfter: true,
        }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: makeRangeResult({
          rangeFrom: "2026-06-22",
          rangeTo: "2026-07-05",
          hasMoreBefore: true,
          hasMoreAfter: false,
        }),
        error: null,
      });

    const client = createClient();
    render(createElement(ListHarness, { enabled: true }), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() =>
      expect(screen.getByTestId("status").getAttribute("data-loading")).toBe("false"),
    );
    await waitFor(() => expect(observerState.instances.length).toBeGreaterThan(0));

    const nextFrom = addCalendarDaysIso("2026-06-21", 1);
    const bottom = screen.getByTestId("bottom-sentinel");
    act(() => {
      for (const instance of observerState.instances) {
        if (instance.observe.mock.calls.some(([node]) => node === bottom)) {
          instance.callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            {} as IntersectionObserver,
          );
        }
      }
    });

    await waitFor(() =>
      expect(fetchProviderScheduledServices).toHaveBeenCalledWith(
        nextFrom,
        addCalendarDaysIso(nextFrom, 13),
      ),
    );
  });

  it("fetches previous page when top sentinel intersects", async () => {
    fetchProviderScheduledServices
      .mockResolvedValueOnce({
        data: makeRangeResult({
          rangeFrom: "2026-06-08",
          rangeTo: "2026-06-21",
          hasMoreBefore: true,
          hasMoreAfter: false,
        }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: makeRangeResult({
          rangeFrom: "2026-05-25",
          rangeTo: "2026-06-07",
          hasMoreBefore: false,
          hasMoreAfter: true,
        }),
        error: null,
      });

    const client = createClient();
    render(createElement(ListHarness, { enabled: true }), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() =>
      expect(screen.getByTestId("status").getAttribute("data-loading")).toBe("false"),
    );
    await waitFor(() => expect(observerState.instances.length).toBeGreaterThan(0));

    const prevTo = addCalendarDaysIso("2026-06-08", -1);
    const top = screen.getByTestId("top-sentinel");
    act(() => {
      for (const instance of observerState.instances) {
        if (instance.observe.mock.calls.some(([node]) => node === top)) {
          instance.callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            {} as IntersectionObserver,
          );
        }
      }
    });

    await waitFor(() =>
      expect(fetchProviderScheduledServices).toHaveBeenCalledWith(
        addCalendarDaysIso(prevTo, -13),
        prevTo,
      ),
    );
  });

  it("does not paginate further when range has no more pages", async () => {
    fetchProviderScheduledServices.mockResolvedValue({
      data: makeRangeResult({ hasMoreBefore: false, hasMoreAfter: false }),
      error: null,
    });

    const client = createClient();
    render(createElement(ListHarness, { enabled: true }), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() =>
      expect(screen.getByTestId("status").getAttribute("data-loading")).toBe("false"),
    );

    const callsAfterLoad = fetchProviderScheduledServices.mock.calls.length;
    act(() => {
      for (const instance of observerState.instances) {
        instance.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      }
    });

    expect(fetchProviderScheduledServices).toHaveBeenCalledTimes(callsAfterLoad);
  });

  it("surfaces query errors", async () => {
    fetchProviderScheduledServices.mockResolvedValue({
      data: null,
      error: new Error("list failed"),
    });

    const client = createClient();
    render(createElement(ListHarness, { enabled: true }), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() =>
      expect(screen.getByTestId("status").getAttribute("data-error")).toBe("true"),
    );
  });

  it("throws when API returns empty data without error", async () => {
    fetchProviderScheduledServices.mockResolvedValue({
      data: null,
      error: null,
    });

    const client = createClient();
    render(createElement(ListHarness, { enabled: true }), {
      wrapper: wrapperFor(client),
    });

    await waitFor(() =>
      expect(screen.getByTestId("status").getAttribute("data-error")).toBe("true"),
    );
  });
});
