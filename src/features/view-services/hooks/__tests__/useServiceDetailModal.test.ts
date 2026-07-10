// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useServiceDetailModal } from "../useServiceDetailModal";

const locationState = vi.hoisted(() => ({
  pathname: "/dashboard/services/sr-1",
  state: null as unknown,
}));

const matchState = vi.hoisted(() => ({
  match: { params: { id: "sr-1" } } as { params: { id: string } } | null,
}));

vi.mock("react-router", () => ({
  useLocation: () => locationState,
  useMatch: () => matchState.match,
}));

vi.mock("../../utils/isServiceDetailSheetLocation", () => ({
  isServiceDetailSheetLocation: (location: { state: unknown }) =>
    Boolean(
      location.state &&
        (location.state as { serviceDetailPresentation?: string })
          .serviceDetailPresentation === "sheet",
    ),
}));

beforeEach(() => {
  locationState.pathname = "/dashboard/services/sr-1";
  locationState.state = null;
  matchState.match = { params: { id: "sr-1" } };
});

describe("useServiceDetailModal", () => {
  it("is closed when location is not a sheet presentation", () => {
    const { result } = renderHook(() => useServiceDetailModal());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.background).toBeNull();
  });

  it("exposes origin flags when opened as sheet", () => {
    locationState.state = {
      serviceDetailPresentation: "sheet",
      background: { pathname: "/dashboard/jobs" },
      returnTo: "/dashboard/jobs",
    };

    const { result } = renderHook(() => useServiceDetailModal());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.isFromProviderJobs).toBe(true);
    expect(result.current.serviceRequestId).toBe("sr-1");
    expect(result.current.background).toEqual({ pathname: "/dashboard/jobs" });
  });

  it("detects provider and client my-services origins", () => {
    locationState.state = {
      serviceDetailPresentation: "sheet",
      background: { pathname: "/dashboard/services" },
      returnTo: "/dashboard/services",
      myServicesRole: "provider",
    };
    const provider = renderHook(() => useServiceDetailModal());
    expect(provider.result.current.isFromProviderMyServices).toBe(true);
    expect(provider.result.current.isFromClientMyServices).toBe(false);

    locationState.state = {
      serviceDetailPresentation: "sheet",
      background: { pathname: "/dashboard/services" },
      returnTo: "/dashboard/services",
      myServicesRole: "client",
    };
    const client = renderHook(() => useServiceDetailModal());
    expect(client.result.current.isFromClientMyServices).toBe(true);
  });

  it("is closed when route does not match", () => {
    matchState.match = null;
    locationState.state = {
      serviceDetailPresentation: "sheet",
      background: { pathname: "/dashboard/services" },
    };
    const { result } = renderHook(() => useServiceDetailModal());
    expect(result.current.isOpen).toBe(false);
  });
});
