import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAuthEventHandlers, processAuthEvent } from "../authStateHandlers";
import type { AuthHandlersContext } from "../authStateHandlers";
import type { Session, User } from "@supabase/supabase-js";

vi.mock("@/lib/cache", () => ({
  cacheRemove: vi.fn(),
  cachePersistRemove: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

function makeSession(userId = "user-123"): Session {
  return {
    user: { id: userId } as User,
    access_token: "token",
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
  } as Session;
}

function makeCtx(overrides: Partial<AuthHandlersContext> = {}): AuthHandlersContext {
  return {
    getIsMounted: vi.fn().mockReturnValue(true),
    setSession: vi.fn(),
    setUser: vi.fn(),
    setProfile: vi.fn(),
    setLoading: vi.fn(),
    setLoadingSession: vi.fn(),
    fetchProfile: vi.fn().mockResolvedValue({ id: "user-123", role: "client" }),
    getRedirectPath: vi.fn().mockReturnValue("/home"),
    navigate: vi.fn(),
    isExplicitSignIn: { current: false },
    lastFetchedUserId: { current: null },
    ...overrides,
  };
}

describe("createAuthEventHandlers", () => {
  let ctx: AuthHandlersContext;

  beforeEach(() => {
    ctx = makeCtx();
    vi.clearAllMocks();
  });

  it("SIGNED_IN sets session and fetches profile", async () => {
    const handlers = createAuthEventHandlers(ctx);
    const session = makeSession();
    handlers.SIGNED_IN(session);

    expect(ctx.setSession).toHaveBeenCalledWith(session);
    expect(ctx.setUser).toHaveBeenCalledWith(session.user);
    // Wait for async fetchProfile
    await Promise.resolve();
  });

  it("SIGNED_IN navigates when isExplicitSignIn is true", async () => {
    ctx = makeCtx({ isExplicitSignIn: { current: true } });
    const handlers = createAuthEventHandlers(ctx);
    const session = makeSession();
    handlers.SIGNED_IN(session);
    await (ctx.fetchProfile as ReturnType<typeof vi.fn>).mock.results[0]?.value;

    // Need a small tick for .then callbacks
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.navigate).toHaveBeenCalledWith("/home", { replace: true });
    expect((ctx.isExplicitSignIn as { current: boolean }).current).toBe(false);
  });

  it("SIGNED_IN does not update state when unmounted", async () => {
    ctx = makeCtx({ getIsMounted: vi.fn().mockReturnValue(false) });
    const handlers = createAuthEventHandlers(ctx);
    handlers.SIGNED_IN(makeSession());
    await Promise.resolve();
    await Promise.resolve();
    // setProfile should NOT be called since component is unmounted
    expect(ctx.setProfile).not.toHaveBeenCalled();
  });

  it("SIGNED_IN with null session sets user to null", () => {
    const handlers = createAuthEventHandlers(ctx);
    handlers.SIGNED_IN(null);
    expect(ctx.setUser).toHaveBeenCalledWith(null);
    expect(ctx.fetchProfile).not.toHaveBeenCalled();
  });

  it("SIGNED_OUT clears session, user, and profile", () => {
    ctx = makeCtx({ lastFetchedUserId: { current: "user-123" } });
    const handlers = createAuthEventHandlers(ctx);
    handlers.SIGNED_OUT(null);

    expect(ctx.setSession).toHaveBeenCalledWith(null);
    expect(ctx.setUser).toHaveBeenCalledWith(null);
    expect(ctx.setProfile).toHaveBeenCalledWith(null);
    expect(ctx.setLoading).toHaveBeenCalledWith(false);
  });

  it("TOKEN_REFRESHED updates session without fetching profile", () => {
    const handlers = createAuthEventHandlers(ctx);
    const session = makeSession();
    handlers.TOKEN_REFRESHED(session);
    expect(ctx.setSession).toHaveBeenCalledWith(session);
    expect(ctx.fetchProfile).not.toHaveBeenCalled();
  });

  it("USER_UPDATED sets session and re-fetches profile with forceRefresh", async () => {
    const handlers = createAuthEventHandlers(ctx);
    const session = makeSession();
    handlers.USER_UPDATED(session);
    expect(ctx.setSession).toHaveBeenCalledWith(session);
    expect(ctx.fetchProfile).toHaveBeenCalledWith("user-123", true);
  });

  it("INITIAL_SESSION (fallback) sets session and fetches profile", async () => {
    const handlers = createAuthEventHandlers(ctx);
    const session = makeSession();
    handlers.INITIAL_SESSION(session);
    expect(ctx.setSession).toHaveBeenCalledWith(session);
    expect(ctx.fetchProfile).toHaveBeenCalledWith("user-123");
  });

  it("INITIAL_SESSION with null session sets profile to null", async () => {
    const handlers = createAuthEventHandlers(ctx);
    handlers.INITIAL_SESSION(null);
    expect(ctx.setProfile).toHaveBeenCalledWith(null);
    expect(ctx.setLoading).toHaveBeenCalledWith(false);
  });

  it("default handler behaves like fallback", () => {
    const handlers = createAuthEventHandlers(ctx);
    const session = makeSession();
    handlers.default(session);
    expect(ctx.setSession).toHaveBeenCalledWith(session);
  });
});

describe("processAuthEvent", () => {
  let ctx: AuthHandlersContext;

  beforeEach(() => {
    ctx = makeCtx();
    vi.clearAllMocks();
  });

  it("routes SIGNED_IN to the SIGNED_IN handler", () => {
    processAuthEvent("SIGNED_IN", makeSession(), ctx);
    expect(ctx.setSession).toHaveBeenCalled();
  });

  it("routes SIGNED_OUT to the SIGNED_OUT handler", () => {
    processAuthEvent("SIGNED_OUT", null, ctx);
    expect(ctx.setProfile).toHaveBeenCalledWith(null);
  });

  it("routes TOKEN_REFRESHED without profile fetch", () => {
    processAuthEvent("TOKEN_REFRESHED", makeSession(), ctx);
    expect(ctx.fetchProfile).not.toHaveBeenCalled();
  });

  it("routes USER_UPDATED and fetches profile with forceRefresh", () => {
    processAuthEvent("USER_UPDATED", makeSession(), ctx);
    expect(ctx.fetchProfile).toHaveBeenCalledWith("user-123", true);
  });

  it("falls back to default for unhandled events", () => {
    processAuthEvent("PASSWORD_RECOVERY" as never, null, ctx);
    expect(ctx.setLoading).toHaveBeenCalledWith(false);
  });
});
