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

  it("sets Sentry user when setUser is called and clears on null", async () => {
    const { setSentryUser } = await import("@/lib/sentry");
    let capturedCtx: { setUser: (u: unknown) => void } | null = null;
    authHarness.processAuthEvent.mockImplementation(
      (_event: AuthChangeEvent, _session: unknown, ctx: { setUser: (u: unknown) => void }) => {
        capturedCtx = ctx;
      }
    );

    renderWithAuth(<div />);
    await act(async () => {
      authHarness.onAuthCallback!("INITIAL_SESSION", null);
    });

    expect(capturedCtx).not.toBeNull();
    await act(async () => {
      capturedCtx!.setUser({ id: "u-sentry", email: "a@b.com" });
    });
    expect(setSentryUser).toHaveBeenCalledWith({
      id: "u-sentry",
      email: "a@b.com",
    });

    await act(async () => {
      capturedCtx!.setUser(null);
    });
    expect(setSentryUser).toHaveBeenCalledWith(null);
  });

  it("unregisters device beacon on signOut when user id is present", async () => {
    const { unregisterDeviceBeaconOnLogout } = await import(
      "@/features/device-beacon"
    );
    const { authApi } = await import("@/features/auth/api/auth.api");
    vi.mocked(authApi.signOut).mockResolvedValue({ error: null });

    let capturedCtx: {
      setUser: (u: unknown) => void;
    } | null = null;
    authHarness.processAuthEvent.mockImplementation(
      (_event: AuthChangeEvent, _session: unknown, ctx: { setUser: (u: unknown) => void }) => {
        capturedCtx = ctx;
      }
    );

    function SignOutProbe() {
      const { signOut } = useAuth();
      return (
        <button type="button" onClick={() => void signOut()}>
          out
        </button>
      );
    }

    const { getByRole } = renderWithAuth(<SignOutProbe />);
    await act(async () => {
      authHarness.onAuthCallback!("INITIAL_SESSION", null);
    });
    await act(async () => {
      capturedCtx!.setUser({ id: "u-logout", email: "x@y.com" });
    });

    await act(async () => {
      getByRole("button", { name: /out/i }).click();
    });

    expect(unregisterDeviceBeaconOnLogout).toHaveBeenCalledWith("u-logout");
    expect(authApi.signOut).toHaveBeenCalled();
  });

  it("does not process a debounced auth event after unmount", async () => {
    const { unmount } = renderWithAuth(<div />);
    await act(async () => {});

    await act(async () => {
      authHarness.onAuthCallback!("SIGNED_IN", { fake: 1 } as never);
    });
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(authHarness.processAuthEvent).not.toHaveBeenCalled();
  });

  it("sets an undefined Sentry email when the auth user email is null", async () => {
    const { setSentryUser } = await import("@/lib/sentry");
    let capturedCtx: { setUser: (u: unknown) => void } | null = null;
    authHarness.processAuthEvent.mockImplementation(
      (_event: AuthChangeEvent, _session: unknown, ctx: { setUser: (u: unknown) => void }) => {
        capturedCtx = ctx;
      }
    );

    renderWithAuth(<div />);
    await act(async () => {
      authHarness.onAuthCallback!("INITIAL_SESSION", null);
      capturedCtx!.setUser({ id: "u-no-email", email: null });
    });

    expect(setSentryUser).toHaveBeenCalledWith({
      id: "u-no-email",
      email: undefined,
    });
  });

  it("uses the profile id to unregister the beacon when user is null", async () => {
    const { unregisterDeviceBeaconOnLogout } = await import(
      "@/features/device-beacon"
    );
    const { authApi } = await import("@/features/auth/api/auth.api");
    vi.mocked(authApi.signOut).mockResolvedValue({ error: null });
    let capturedCtx: { setProfile: (profile: unknown) => void } | null = null;
    authHarness.processAuthEvent.mockImplementation(
      (
        _event: AuthChangeEvent,
        _session: unknown,
        ctx: { setProfile: (profile: unknown) => void }
      ) => {
        capturedCtx = ctx;
      }
    );

    function SignOutProbe() {
      const { signOut } = useAuth();
      return <button onClick={() => void signOut()}>profile-out</button>;
    }

    const { getByRole } = renderWithAuth(<SignOutProbe />);
    await act(async () => {
      authHarness.onAuthCallback!("INITIAL_SESSION", null);
      capturedCtx!.setProfile({
        id: "profile-only",
        role: "provider",
        full_name: "Provider",
      });
    });
    await act(async () => {
      getByRole("button", { name: "profile-out" }).click();
    });

    expect(unregisterDeviceBeaconOnLogout).toHaveBeenCalledWith("profile-only");
  });

  it("signOut skips beacon unregister when no user or profile id", async () => {
    const { unregisterDeviceBeaconOnLogout } = await import(
      "@/features/device-beacon"
    );
    const { authApi } = await import("@/features/auth/api/auth.api");
    vi.mocked(authApi.signOut).mockResolvedValue({ error: null });
    vi.mocked(unregisterDeviceBeaconOnLogout).mockClear();

    function SignOutProbe() {
      const { signOut } = useAuth();
      return <button onClick={() => void signOut()}>no-id-out</button>;
    }

    const { getByRole } = renderWithAuth(<SignOutProbe />);
    await act(async () => {
      authHarness.onAuthCallback!("INITIAL_SESSION", null);
    });
    await act(async () => {
      getByRole("button", { name: "no-id-out" }).click();
    });

    expect(unregisterDeviceBeaconOnLogout).not.toHaveBeenCalled();
    expect(authApi.signOut).toHaveBeenCalled();
  });

  it("signOut shows error toast when API throws", async () => {
    const { toast } = await import("sonner");
    const { authApi } = await import("@/features/auth/api/auth.api");
    vi.mocked(authApi.signOut).mockResolvedValue({
      error: { message: "network" } as never,
    });

    function SignOutProbe() {
      const { signOut } = useAuth();
      return <button onClick={() => void signOut()}>fail-out</button>;
    }

    const { getByRole } = renderWithAuth(<SignOutProbe />);
    await act(async () => {
      authHarness.onAuthCallback!("INITIAL_SESSION", null);
    });
    await act(async () => {
      getByRole("button", { name: "fail-out" }).click();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível sair. Tente novamente.",
    );
  });

  it("ignores auth callbacks delivered after unmount", async () => {
    const { unmount } = renderWithAuth(<div />);
    await act(async () => {});
    const callback = authHarness.onAuthCallback;

    unmount();
    await act(async () => {
      callback!("SIGNED_IN", { fake: "late" } as never);
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(authHarness.processAuthEvent).not.toHaveBeenCalled();
  });
});
