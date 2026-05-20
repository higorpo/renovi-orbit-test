import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router";
import type { User } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "../useAuth";

const profileMocks = vi.hoisted(() => ({
  fetchProfile: vi.fn().mockResolvedValue(null),
  refreshProfile: vi.fn(),
  lastFetchedUserId: { current: null as string | null },
}));

vi.mock("@/features/auth/api/auth.api", () => ({
  authApi: {
    onAuthStateChange: (_cb: (event: string, session: unknown) => void) => {
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
    fetchProfile: profileMocks.fetchProfile,
    refreshProfile: profileMocks.refreshProfile,
    lastFetchedUserId: profileMocks.lastFetchedUserId,
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
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { authApi } = await import("@/features/auth/api/auth.api");

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileMocks.fetchProfile.mockResolvedValue(null);
  });

  it("throws when used outside AuthProvider", () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow(/AuthProvider/);
  });

  it("exposes signIn that delegates to authApi.signInWithPassword", async () => {
    vi.mocked(authApi.signInWithPassword).mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signIn("a@b.com", "secret");
    });
    expect(authApi.signInWithPassword).toHaveBeenCalledWith("a@b.com", "secret");
  });

  it("signIn shows error toast when API returns error", async () => {
    const { toast } = await import("sonner");
    vi.mocked(authApi.signInWithPassword).mockResolvedValue({
      error: new Error("Invalid"),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.signIn("a@b.com", "wrong");
      })
    ).rejects.toBeDefined();
    expect(toast.error).toHaveBeenCalled();
  });

  it("signInWithGoogle delegates to authApi.signInWithOAuth", async () => {
    vi.mocked(authApi.signInWithOAuth).mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signInWithGoogle("https://app/callback");
    });
    expect(authApi.signInWithOAuth).toHaveBeenCalledWith("google", {
      redirectTo: "https://app/callback",
    });
  });

  it("signInWithGoogle shows toast and rethrows when OAuth returns error", async () => {
    const { toast } = await import("sonner");
    vi.mocked(authApi.signInWithOAuth).mockResolvedValue({
      error: new Error("denied"),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.signInWithGoogle();
      })
    ).rejects.toBeDefined();
    expect(toast.error).toHaveBeenCalledWith(
      "Erro ao conectar com Google. Tente novamente."
    );
  });

  it("signUp returns error when password is weak", async () => {
    const { toast } = await import("sonner");
    const { result } = renderHook(() => useAuth(), { wrapper });

    let out: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      out = await result.current.signUp(
        "a@b.com",
        "short",
        "Name",
        "client"
      );
    });
    expect(out!).toEqual({
      success: false,
      reason: "error",
      message: "Senha deve ter no mínimo 10 caracteres",
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Senha deve ter no mínimo 10 caracteres"
    );
    expect(authApi.signUp).not.toHaveBeenCalled();
  });

  it("signUp returns already_registered when API says user exists", async () => {
    const { toast } = await import("sonner");
    vi.mocked(authApi.signUp).mockResolvedValue({
      user: null,
      error: new Error("User already registered"),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    let out: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      out = await result.current.signUp(
        "x@y.com",
        "Validpass1!",
        "Name",
        "provider"
      );
    });
    expect(out!).toEqual({ success: false, reason: "already_registered" });
    expect(toast.error).toHaveBeenCalled();
  });

  it("signUp returns error with API message for other failures", async () => {
    const { toast } = await import("sonner");
    vi.mocked(authApi.signUp).mockResolvedValue({
      user: null,
      error: new Error("Rate limited"),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    let out: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      out = await result.current.signUp(
        "x@y.com",
        "Validpass1!",
        "Name",
        "client"
      );
    });
    expect(out!).toMatchObject({
      success: false,
      reason: "error",
      message: "Rate limited",
    });
    expect(toast.error).toHaveBeenCalledWith("Rate limited");
  });

  it("signUp returns error when user id is missing", async () => {
    const { toast } = await import("sonner");
    vi.mocked(authApi.signUp).mockResolvedValue({
      user: { id: "" } as User,
      error: null,
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    let out: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      out = await result.current.signUp(
        "x@y.com",
        "Validpass1!",
        "Name",
        "client"
      );
    });
    expect(out!).toMatchObject({ success: false, reason: "error" });
    expect(toast.error).toHaveBeenCalledWith(
      "Erro ao criar conta. Tente novamente."
    );
  });

  it("signUp succeeds when email is not confirmed yet", async () => {
    const { toast } = await import("sonner");
    vi.mocked(authApi.signUp).mockResolvedValue({
      user: { id: "u1", email_confirmed_at: undefined } as User,
      error: null,
    });
    profileMocks.fetchProfile.mockResolvedValue({
      id: "u1",
      role: "client",
      full_name: "N",
    } as never);
    const { result } = renderHook(() => useAuth(), { wrapper });

    let out: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      out = await result.current.signUp(
        "x@y.com",
        "Validpass1!",
        "Name",
        "client",
        { emailRedirectTo: "https://x/confirm" }
      );
    });
    expect(out!).toEqual({ success: true, userId: "u1" });
    expect(authApi.signUp).toHaveBeenCalledWith(
      "x@y.com",
      "Validpass1!",
      expect.objectContaining({
        data: { full_name: "Name", role: "client" },
        emailRedirectTo: "https://x/confirm",
      })
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Cadastro realizado! Por favor, confirme seu email para fazer login."
    );
  });

  it("signUp succeeds when email is already confirmed", async () => {
    const { toast } = await import("sonner");
    vi.mocked(authApi.signUp).mockResolvedValue({
      user: { id: "u2", email_confirmed_at: "2024-01-01" } as User,
      error: null,
    });
    profileMocks.fetchProfile.mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });

    let out: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      out = await result.current.signUp(
        "x@y.com",
        "Validpass1!",
        "Name",
        "provider"
      );
    });
    expect(out!).toEqual({ success: true, userId: "u2" });
    expect(toast.success).toHaveBeenCalledWith(
      "Cadastro realizado! Redirecionando..."
    );
  });

  it("signUp catch returns error when fetchProfile throws", async () => {
    const { toast } = await import("sonner");
    vi.mocked(authApi.signUp).mockResolvedValue({
      user: { id: "u3", email_confirmed_at: undefined } as User,
      error: null,
    });
    profileMocks.fetchProfile.mockRejectedValue(new Error("profile boom"));
    const { result } = renderHook(() => useAuth(), { wrapper });

    let out: Awaited<ReturnType<typeof result.current.signUp>>;
    await act(async () => {
      out = await result.current.signUp(
        "x@y.com",
        "Validpass1!",
        "Name",
        "client"
      );
    });
    expect(out!).toMatchObject({
      success: false,
      reason: "error",
      message: "profile boom",
    });
    expect(toast.error).toHaveBeenCalledWith("profile boom");
  });

  it("signOut clears session and shows success when API ok", async () => {
    const { toast } = await import("sonner");
    vi.mocked(authApi.signOut).mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signOut();
    });
    expect(authApi.signOut).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      "Logout realizado com sucesso!"
    );
  });

  it("signOut shows error toast when API returns error", async () => {
    const { toast } = await import("sonner");
    vi.mocked(authApi.signOut).mockResolvedValue({
      error: new Error("nope"),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signOut();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível sair. Tente novamente."
    );
  });
});
