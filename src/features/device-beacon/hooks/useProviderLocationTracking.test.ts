// @vitest-environment happy-dom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderLocationTracking } from "./useProviderLocationTracking";

type MockProfile = { role: "provider" | "client"; operational_status?: string | null };

const authMocks = vi.hoisted(() => ({
  user: { id: "provider-1" } as { id: string } | null,
  profile: { role: "provider" } as MockProfile,
  loadingSession: false,
}));

const runtimeMocks = vi.hoisted(() => ({
  startProviderLocationTracking: vi.fn(),
  stopProviderLocationTracking: vi.fn(),
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => authMocks,
}));

vi.mock("../utils/providerLocationTracking.runtime", () => runtimeMocks);

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("useProviderLocationTracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.user = { id: "provider-1" };
    authMocks.profile = { role: "provider" };
    authMocks.loadingSession = false;
  });

  it("starts tracking for providers", async () => {
    renderHook(() => useProviderLocationTracking());

    await waitFor(() =>
      expect(runtimeMocks.startProviderLocationTracking).toHaveBeenCalledWith(
        "provider-1",
      ),
    );
  });

  it("does not start tracking for clients", async () => {
    authMocks.profile = { role: "client" };
    renderHook(() => useProviderLocationTracking());

    await waitFor(() =>
      expect(runtimeMocks.stopProviderLocationTracking).toHaveBeenCalled(),
    );
    expect(runtimeMocks.startProviderLocationTracking).not.toHaveBeenCalled();
  });

  it("stops tracking when provider is suspended", async () => {
    authMocks.profile = { role: "provider", operational_status: "suspended" };
    renderHook(() => useProviderLocationTracking());

    await waitFor(() =>
      expect(runtimeMocks.stopProviderLocationTracking).toHaveBeenCalled(),
    );
    expect(runtimeMocks.startProviderLocationTracking).not.toHaveBeenCalled();
  });
});
