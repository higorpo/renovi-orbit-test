// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderCalendarPage } from "../useProviderCalendarPage";

const navigate = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => navigate,
    useLocation: () => ({ pathname: "/dashboard/services/calendar", state: null }),
  };
});

vi.mock("../useProviderCalendarViewMode", () => ({
  useProviderCalendarViewMode: vi.fn(),
}));

vi.mock("../useProviderCalendarList", () => ({
  useProviderCalendarList: vi.fn(),
}));

vi.mock("../useProviderCalendarMonth", () => ({
  useProviderCalendarMonth: vi.fn(),
}));

vi.mock("@/features/view-services", () => ({
  getServiceDetailPath: (id: string) => `/dashboard/services/${id}`,
  createProviderCalendarServiceDetailState: (location: unknown) => ({
    returnTo: "/dashboard/services/calendar",
    myServicesRole: "provider",
    background: location,
  }),
}));

const useProviderCalendarViewMode = vi.mocked(
  await import("../useProviderCalendarViewMode").then((m) => m.useProviderCalendarViewMode),
);
const useProviderCalendarList = vi.mocked(
  await import("../useProviderCalendarList").then((m) => m.useProviderCalendarList),
);
const useProviderCalendarMonth = vi.mocked(
  await import("../useProviderCalendarMonth").then((m) => m.useProviderCalendarMonth),
);

const listResult = {
  days: [],
  today: "2026-06-15",
  isLoading: false,
  isFetchingNextPage: false,
  isLoadingBackward: false,
  isError: false,
  refetch: vi.fn(),
  topSentinelRef: { current: null },
  bottomSentinelRef: { current: null },
};

const monthResult = {
  year: 2026,
  monthIndex: 5,
  monthLabel: "Junho de 2026",
  weeks: [],
  services: [],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  goToPreviousMonth: vi.fn(),
  goToNextMonth: vi.fn(),
  goToToday: vi.fn(),
};

function wrapper({ children }: { children: ReactNode }) {
  return createElement(MemoryRouter, null, children);
}

describe("useProviderCalendarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProviderCalendarViewMode.mockReturnValue({ viewMode: "list", isDesktop: false });
    useProviderCalendarList.mockReturnValue(listResult as never);
    useProviderCalendarMonth.mockReturnValue(monthResult as never);
  });

  it("enables list query and exposes list loading/error in list mode", () => {
    useProviderCalendarList.mockReturnValue({
      ...listResult,
      isLoading: true,
      isError: false,
    } as never);

    const { result } = renderHook(() => useProviderCalendarPage(), { wrapper });

    expect(useProviderCalendarList).toHaveBeenCalledWith(true);
    expect(useProviderCalendarMonth).toHaveBeenCalledWith(false);
    expect(result.current.viewMode).toBe("list");
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.refetch).toBe(listResult.refetch);
  });

  it("enables month query and exposes month loading/error in grid mode", () => {
    useProviderCalendarViewMode.mockReturnValue({ viewMode: "grid", isDesktop: true });
    useProviderCalendarMonth.mockReturnValue({
      ...monthResult,
      isLoading: false,
      isError: true,
    } as never);

    const { result } = renderHook(() => useProviderCalendarPage(), { wrapper });

    expect(useProviderCalendarList).toHaveBeenCalledWith(false);
    expect(useProviderCalendarMonth).toHaveBeenCalledWith(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
    expect(result.current.refetch).toBe(monthResult.refetch);
  });

  it("navigates to service detail with calendar return state", () => {
    const { result } = renderHook(() => useProviderCalendarPage(), { wrapper });

    act(() => {
      result.current.handleOpenService({
        serviceRequestId: "sr-99",
        contractedServiceId: "cs-99",
        title: "Elétrica",
        platformServiceTitle: null,
        platformServiceColorKey: null,
        scheduledStartDate: "2026-06-15",
        scheduledEndDate: "2026-06-15",
        scheduledShift: "afternoon",
        status: "IN_PROGRESS",
      });
    });

    expect(navigate).toHaveBeenCalledWith("/dashboard/services/sr-99", {
      state: {
        returnTo: "/dashboard/services/calendar",
        myServicesRole: "provider",
        background: { pathname: "/dashboard/services/calendar", state: null },
      },
    });
  });
});
