// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { authApi, resolveSafeOAuthRedirectTo } from "../auth.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      signInWithOAuth: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

const { supabase } = await import("@/lib/supabase/client");
const authMock = supabase.auth as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authApi.getSession", () => {
  it("returns session on success", async () => {
    const mockSession = { access_token: "token" };
    authMock.getSession.mockResolvedValue({ data: { session: mockSession }, error: null });

    const result = await authApi.getSession();
    expect(result.session).toEqual(mockSession);
    expect(result.error).toBeNull();
  });

  it("returns error when supabase returns error", async () => {
    authMock.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Network error" },
    });

    const result = await authApi.getSession();
    expect(result.session).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe("Network error");
  });
});

describe("authApi.getCurrentUser", () => {
  it("returns user on success", async () => {
    const mockUser = { id: "user-1" };
    authMock.getUser.mockResolvedValue({ data: { user: mockUser } });

    const result = await authApi.getCurrentUser();
    expect(result.user).toEqual(mockUser);
  });

  it("returns null user when no user", async () => {
    authMock.getUser.mockResolvedValue({ data: { user: null } });

    const result = await authApi.getCurrentUser();
    expect(result.user).toBeNull();
  });
});

describe("authApi.onAuthStateChange", () => {
  it("calls supabase.auth.onAuthStateChange and returns unsubscribe fn", () => {
    const unsubscribeFn = vi.fn();
    authMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: unsubscribeFn } },
    });

    const callback = vi.fn();
    const { unsubscribe } = authApi.onAuthStateChange(callback);

    expect(authMock.onAuthStateChange).toHaveBeenCalledWith(callback);
    unsubscribe();
    expect(unsubscribeFn).toHaveBeenCalled();
  });
});

describe("authApi.signInWithPassword", () => {
  it("returns null error on success", async () => {
    authMock.signInWithPassword.mockResolvedValue({ error: null });

    const result = await authApi.signInWithPassword("user@example.com", "pass");
    expect(result.error).toBeNull();
  });

  it("returns error on failure", async () => {
    authMock.signInWithPassword.mockResolvedValue({ error: { message: "Wrong password" } });

    const result = await authApi.signInWithPassword("user@example.com", "wrong");
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe("Wrong password");
  });
});

describe("authApi.signUp", () => {
  it("returns user on success with identities", async () => {
    const mockUser = { id: "new-user", identities: [{ id: "identity-1" }] };
    authMock.signUp.mockResolvedValue({ data: { user: mockUser }, error: null });

    const result = await authApi.signUp("user@example.com", "pass", { data: { full_name: "Test User" } });
    expect(result.user).toEqual(mockUser);
    expect(result.error).toBeNull();
  });

  it("returns 'already registered' error when identities is empty", async () => {
    const mockUser = { id: "existing-user", identities: [] };
    authMock.signUp.mockResolvedValue({ data: { user: mockUser }, error: null });

    const result = await authApi.signUp("existing@example.com", "pass", {});
    expect(result.user).toBeNull();
    expect(result.error?.message).toBe("User already registered");
  });

  it("returns generic error on signup failure", async () => {
    authMock.signUp.mockResolvedValue({
      data: { user: null },
      error: { message: "Email already taken" },
    });

    const result = await authApi.signUp("user@example.com", "pass", {});
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe("Não foi possível criar a conta. Tente novamente.");
  });
});

describe("authApi.signOut", () => {
  it("returns null error on success", async () => {
    authMock.signOut.mockResolvedValue({ error: null });

    const result = await authApi.signOut();
    expect(result.error).toBeNull();
  });

  it("returns error on failure", async () => {
    authMock.signOut.mockResolvedValue({ error: { message: "Sign out failed" } });

    const result = await authApi.signOut();
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe("authApi.signInWithOAuth", () => {
  it("returns null error on success", async () => {
    authMock.signInWithOAuth.mockResolvedValue({ error: null });

    const result = await authApi.signInWithOAuth("google");
    expect(result.error).toBeNull();
  });

  it("uses origin-based redirectTo by default", async () => {
    authMock.signInWithOAuth.mockResolvedValue({ error: null });

    await authApi.signInWithOAuth("google");
    const callArgs = authMock.signInWithOAuth.mock.calls[0][0];
    expect(callArgs.options.redirectTo).toContain("login");
  });

  it("prefixes relative redirect path with origin", async () => {
    authMock.signInWithOAuth.mockResolvedValue({ error: null });

    await authApi.signInWithOAuth("google", { redirectTo: "/dashboard" });
    const callArgs = authMock.signInWithOAuth.mock.calls[0][0];
    expect(callArgs.options.redirectTo).not.toMatch(/^\//);
  });

  it("rejects external redirectTo not starting with origin", async () => {
    authMock.signInWithOAuth.mockResolvedValue({ error: null });

    await authApi.signInWithOAuth("google", { redirectTo: "https://evil.com/hack" });
    const callArgs = authMock.signInWithOAuth.mock.calls[0][0];
    // Should fall back to ${origin}/login
    expect(callArgs.options.redirectTo).toContain("login");
  });

  it("rejects same-origin-prefix attack (origin + .evil.com)", async () => {
    authMock.signInWithOAuth.mockResolvedValue({ error: null });
    const origin = window.location.origin;
    const malicious = `${origin}.evil.com/path`;
    await authApi.signInWithOAuth("google", { redirectTo: malicious });
    const callArgs = authMock.signInWithOAuth.mock.calls[0][0];
    expect(callArgs.options.redirectTo).toBe(`${origin}/login`);
  });

  it("rejects protocol-relative redirect", async () => {
    authMock.signInWithOAuth.mockResolvedValue({ error: null });
    await authApi.signInWithOAuth("google", { redirectTo: "//evil.com/x" });
    const callArgs = authMock.signInWithOAuth.mock.calls[0][0];
    expect(callArgs.options.redirectTo).toContain("login");
  });

  it("returns error on OAuth failure", async () => {
    authMock.signInWithOAuth.mockResolvedValue({ error: { message: "OAuth failed" } });

    const result = await authApi.signInWithOAuth("google");
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe("resolveSafeOAuthRedirectTo", () => {
  const origin = "https://app.example.com";

  it("allows same-origin absolute URL", () => {
    expect(resolveSafeOAuthRedirectTo(`${origin}/dashboard`, origin)).toBe(
      "https://app.example.com/dashboard"
    );
  });

  it("resolves relative path against origin", () => {
    expect(resolveSafeOAuthRedirectTo("/me", origin)).toBe(
      "https://app.example.com/me"
    );
  });

  it("rejects different origin", () => {
    expect(resolveSafeOAuthRedirectTo("https://evil.com/x", origin)).toBe(
      `${origin}/login`
    );
  });

  it("rejects userinfo in URL", () => {
    expect(
      resolveSafeOAuthRedirectTo("https://user:pass@app.example.com/x", origin)
    ).toBe(`${origin}/login`);
  });
});

describe("authApi.resetPasswordForEmail", () => {
  it("returns null error on success", async () => {
    authMock.resetPasswordForEmail.mockResolvedValue({ error: null });

    const result = await authApi.resetPasswordForEmail("user@example.com", "https://app.com/reset");
    expect(result.error).toBeNull();
  });

  it("returns error on failure", async () => {
    authMock.resetPasswordForEmail.mockResolvedValue({ error: { message: "Rate limited" } });

    const result = await authApi.resetPasswordForEmail("user@example.com", "https://app.com/reset");
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe("Rate limited");
  });
});

describe("authApi.updateUserPassword", () => {
  it("returns null error on success", async () => {
    authMock.updateUser.mockResolvedValue({ error: null });

    const result = await authApi.updateUserPassword("NewPassword1!");
    expect(result.error).toBeNull();
  });

  it("returns error on failure", async () => {
    authMock.updateUser.mockResolvedValue({ error: { message: "Too weak" } });

    const result = await authApi.updateUserPassword("weak");
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe("Too weak");
  });
});
