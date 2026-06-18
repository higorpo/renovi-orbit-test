import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { AuthProvider } from "../../AuthProvider";
import { useAuth } from "../useAuth";

const authHarness = vi.hoisted(() => ({
  onAuthCallback: null as
    | ((event: AuthChangeEvent, session: unknown) => void)
    | null,
  processAuthEvent: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@/features/auth/utils/authStateHandlers", () => ({
  processAuthEvent: (
    event: AuthChangeEvent,
    session: unknown,
    ctx: unknown
  ) => authHarness.processAuthEvent(event, session, ctx),
}));

vi.mock("@/features/auth/api/auth.api", () => ({
  authApi: {
    onAuthStateChange: (cb: (event: AuthChangeEvent, session: unknown) => void) => {
      authHarness.onAuthCallback = cb;
      return { unsubscribe: vi.fn() };
    },
    signInWithPassword: vi.fn(),
    signInWithOAuth: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock("../useProfileFetcher", () => ({
  useProfileFetcher: () => ({
    fetchProfile: vi.fn().mockResolvedValue(null),
    refreshProfile: vi.fn(),
    lastFetchedUserId: { current: null },
  }),
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}));

vi.mock("@/features/device-beacon", () => ({
  unregisterDeviceBeaconOnLogout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sentry", () => ({
  setSentryUser: vi.fn(),
  addBreadcrumb: vi.fn(),
  metrics: { count: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    warn: authHarness.loggerWarn,
    error: vi.fn(),
  },
}));

function LoadingProbe() {
  const { loading } = useAuth();
  return <span data-testid="auth-loading">{loading ? "true" : "false"}</span>;
}

function renderWithAuth(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

describe("AuthProvider auth state orchestration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    authHarness.onAuthCallback = null;
    vi.clearAllMocks();
    authHarness.loggerWarn.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls processAuthEvent immediately for INITIAL_SESSION (no debounce)", async () => {
    renderWithAuth(<div />);
    await act(async () => {});
    expect(authHarness.onAuthCallback).toBeTypeOf("function");

    await act(async () => {
      authHarness.onAuthCallback!("INITIAL_SESSION", null);
    });

    expect(authHarness.processAuthEvent).toHaveBeenCalledTimes(1);
    expect(authHarness.processAuthEvent).toHaveBeenCalledWith(
      "INITIAL_SESSION",
      null,
      expect.objectContaining({
        setSession: expect.any(Function),
        setUser: expect.any(Function),
      })
    );
  });

  it("debounces non-initial events and forwards the last one after 300ms", async () => {
    renderWithAuth(<div />);
    await act(async () => {});
    expect(authHarness.onAuthCallback).toBeTypeOf("function");

    await act(async () => {
      authHarness.onAuthCallback!("TOKEN_REFRESHED", { fake: 1 } as never);
      authHarness.onAuthCallback!("SIGNED_IN", { fake: 2 } as never);
    });
    expect(authHarness.processAuthEvent).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(authHarness.processAuthEvent).toHaveBeenCalledTimes(1);
    expect(authHarness.processAuthEvent).toHaveBeenCalledWith(
      "SIGNED_IN",
      { fake: 2 },
      expect.any(Object)
    );
  });

  it("clears session timeout when INITIAL_SESSION fires", async () => {
    renderWithAuth(<div />);
    await act(async () => {});

    await act(async () => {
      authHarness.onAuthCallback!("INITIAL_SESSION", null);
    });

    authHarness.loggerWarn.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(authHarness.loggerWarn).not.toHaveBeenCalledWith(
      "auth_session_fetch_timeout",
      expect.anything()
    );
  });

  it("stops loading and logs when session fetch times out before INITIAL_SESSION", async () => {
    const { getByTestId } = renderWithAuth(<LoadingProbe />);
    await act(async () => {});

    expect(getByTestId("auth-loading").textContent).toBe("true");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(getByTestId("auth-loading").textContent).toBe("false");
    expect(authHarness.loggerWarn).toHaveBeenCalledWith(
      "auth_session_fetch_timeout",
      {
        afterMs: 5000,
      }
    );
  });
});
