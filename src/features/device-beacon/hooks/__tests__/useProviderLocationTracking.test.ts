// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  user: { id: "provider-1" } as { id: string } | null,
  profile: {
    role: "provider" as "provider" | "client",
    operational_status: "active" as string | undefined,
  },
  loadingSession: false,
}));

const trackingMocks = vi.hoisted(() => ({
  startProviderLocationTracking: vi.fn(),
  stopProviderLocationTracking: vi.fn(),
}));

const loggerMocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => authMocks,
}));

vi.mock("../../utils/providerLocationTracking.runtime", () => trackingMocks);

vi.mock("@/lib/logger", () => ({
  logger: loggerMocks,
}));

import { useProviderLocationTracking } from "../useProviderLocationTracking";

describe("useProviderLocationTracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.user = { id: "provider-1" };
    authMocks.profile = { role: "provider", operational_status: "active" };
    authMocks.loadingSession = false;
  });

  it("does nothing while the session is still loading", () => {
    authMocks.loadingSession = true;
    renderHook(() => useProviderLocationTracking());

    expect(trackingMocks.startProviderLocationTracking).not.toHaveBeenCalled();
    expect(trackingMocks.stopProviderLocationTracking).not.toHaveBeenCalled();
  });

  it("starts tracking for an active provider and stops on unmount", () => {
    const { unmount } = renderHook(() => useProviderLocationTracking());

    expect(loggerMocks.info).toHaveBeenCalledWith("provider_location_tracking_started", {
      profileId: "provider-1",
    });
    expect(trackingMocks.startProviderLocationTracking).toHaveBeenCalledWith("provider-1");

    unmount();
    expect(loggerMocks.info).toHaveBeenCalledWith("provider_location_tracking_stopped", {
      profileId: "provider-1",
    });
    expect(trackingMocks.stopProviderLocationTracking).toHaveBeenCalled();
  });

  it("stops tracking when the user is not a provider", () => {
    authMocks.profile = { role: "client", operational_status: "active" };
    renderHook(() => useProviderLocationTracking());

    expect(trackingMocks.startProviderLocationTracking).not.toHaveBeenCalled();
    expect(trackingMocks.stopProviderLocationTracking).toHaveBeenCalled();
  });

  it("stops tracking when the provider is suspended", () => {
    authMocks.profile = { role: "provider", operational_status: "suspended" };
    renderHook(() => useProviderLocationTracking());

    expect(trackingMocks.startProviderLocationTracking).not.toHaveBeenCalled();
    expect(trackingMocks.stopProviderLocationTracking).toHaveBeenCalled();
  });

  it("stops tracking when there is no authenticated user", () => {
    authMocks.user = null;
    renderHook(() => useProviderLocationTracking());

    expect(trackingMocks.startProviderLocationTracking).not.toHaveBeenCalled();
    expect(trackingMocks.stopProviderLocationTracking).toHaveBeenCalled();
  });
});
