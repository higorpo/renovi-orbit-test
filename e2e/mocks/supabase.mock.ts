/**
 * Network-level Supabase mock helpers.
 *
 * Uses Playwright's page.route() to intercept every HTTP call the
 * Supabase JS client makes, so no real requests leave the browser.
 */
import type { Page, Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MockUser {
  id: string;
  email: string;
  role: string;
  full_name: string;
  email_confirmed_at?: string | null;
  identities?: { id: string; provider: string }[];
}

export interface MockProfile {
  id: string;
  role: "client" | "provider" | "admin";
  full_name: string;
}

export interface SupabaseMockOptions {
  /**
   * When set, getSession / onAuthStateChange will return this user as
   * already authenticated. Leave undefined to simulate a guest.
   */
  authenticatedUser?: MockUser;
  profile?: MockProfile;
}

// ---------------------------------------------------------------------------
// Factories — create realistic Supabase response shapes
// ---------------------------------------------------------------------------

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-uuid-1234",
    email: "test@example.com",
    role: "client",
    full_name: "Test User",
    email_confirmed_at: new Date().toISOString(),
    identities: [{ id: "id-1", provider: "email" }],
    ...overrides,
  };
}

export function createMockProfile(
  overrides: Partial<MockProfile> = {}
): MockProfile {
  return {
    id: "user-uuid-1234",
    role: "client",
    full_name: "Test User",
    ...overrides,
  };
}

export function buildSessionResponse(user: MockUser) {
  return {
    access_token: "mock-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "mock-refresh-token",
    user: {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      phone: "",
      confirmed_at: user.email_confirmed_at,
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {
        full_name: user.full_name,
        role: user.role,
      },
      identities: user.identities ?? [{ id: user.id, provider: "email" }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

function buildSignupResponse(user: MockUser) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: user.email_confirmed_at ?? null,
    phone: "",
    confirmed_at: user.email_confirmed_at ?? null,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {
      full_name: user.full_name,
      role: user.role,
    },
    identities: user.identities ?? [{ id: user.id, provider: "email" }],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Core mock installer
// ---------------------------------------------------------------------------

/**
 * Intercept all Supabase HTTP endpoints on the given page.
 *
 * Returns a handle with methods to override specific responses at runtime
 * (e.g. simulate login failure after the page has loaded).
 */
export async function installSupabaseMocks(
  page: Page,
  options: SupabaseMockOptions = {}
) {
  const { authenticatedUser, profile } = options;

  // Signup flows call executeRecaptcha + verify-recaptcha; real Google/render fails on localhost.
  await page.addInitScript(() => {
    (
      window as unknown as {
        grecaptcha: {
          ready: (cb: () => void) => void;
          execute: (
            _siteKey: string,
            _opts: { action: string }
          ) => Promise<string>;
        };
      }
    ).grecaptcha = {
      ready: (cb) => {
        cb();
      },
      execute: async () => "e2e-mock-recaptcha-token",
    };
  });

  await page.route("**/functions/v1/verify-recaptcha", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  // Tracks intercepted request bodies so tests can assert on them
  const capturedRequests: Record<string, unknown[]> = {
    signIn: [],
    signUp: [],
    recover: [],
    updateUser: [],
    oauthSignIn: [],
  };

  const capturedUrls: Record<string, string[]> = {
    recover: [],
  };

  // Runtime overrides — tests can mutate these between interactions
  let signInHandler: ((route: Route) => Promise<void>) | null = null;
  let signUpHandler: ((route: Route) => Promise<void>) | null = null;
  let recoverHandler: ((route: Route) => Promise<void>) | null = null;
  let updateUserHandler: ((route: Route) => Promise<void>) | null = null;

  // ── GET /auth/v1/session ──────────────────────────────────────────────
  // Supabase JS calls this via getSession() on init
  // We don't need to intercept this directly as Supabase stores session in localStorage
  // Instead we mock the token endpoint which getSession falls back to

  // ── POST /auth/v1/token?grant_type=password (signInWithPassword) ──────
  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    const body = route.request().postDataJSON();
    capturedRequests.signIn.push(body);

    if (signInHandler) {
      await signInHandler(route);
      return;
    }

    const user = authenticatedUser ?? createMockUser({ email: body?.email });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildSessionResponse(user)),
    });
  });

  // ── POST /auth/v1/signup ──────────────────────────────────────────────
  // Use regex so query params (e.g. from redirectTo) do not prevent matching
  await page.route(/\/auth\/v1\/signup/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON();
    capturedRequests.signUp.push(body);

    if (signUpHandler) {
      await signUpHandler(route);
      return;
    }

    // Supabase JS sends metadata in body.data, not body.options.data
    const data = body?.data ?? body?.options?.data;
    const newUser = createMockUser({
      email: body?.email,
      full_name: data?.full_name ?? "New User",
      role: data?.role ?? "client",
      email_confirmed_at: null,
      identities: [{ id: "new-id", provider: "email" }],
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildSignupResponse(newUser)),
    });
  });

  // ── POST /auth/v1/recover ─────────────────────────────────────────────
  await page.route(/\/auth\/v1\/recover/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const url = route.request().url();
    capturedUrls.recover.push(url);
    const body = route.request().postDataJSON();
    capturedRequests.recover.push(body);

    if (recoverHandler) {
      await recoverHandler(route);
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // ── PUT /auth/v1/user (updateUser — password reset) ───────────────────
  await page.route("**/auth/v1/user", async (route) => {
    if (route.request().method() !== "PUT") {
      await route.fallback();
      return;
    }

    const body = route.request().postDataJSON();
    capturedRequests.updateUser.push(body);

    if (updateUserHandler) {
      await updateUserHandler(route);
      return;
    }

    const user = authenticatedUser ?? createMockUser();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        user_metadata: { full_name: user.full_name, role: user.role },
      }),
    });
  });

  // ── GET /auth/v1/user (getUser) ───────────────────────────────────────
  await page.route("**/auth/v1/user", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    if (!authenticatedUser) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          code: 401,
          msg: "Invalid token",
          message: "Invalid token",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: authenticatedUser.id,
        aud: "authenticated",
        role: "authenticated",
        email: authenticatedUser.email,
        email_confirmed_at: authenticatedUser.email_confirmed_at,
        user_metadata: {
          full_name: authenticatedUser.full_name,
          role: authenticatedUser.role,
        },
        app_metadata: { provider: "email", providers: ["email"] },
        identities: authenticatedUser.identities ?? [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
  });

  // ── GET /rest/v1/profiles (getProfile) ────────────────────────────────
  await page.route("**/rest/v1/profiles*", async (route) => {
    if (!profile) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(null),
        headers: {
          "content-range": "0-0/0",
        },
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(profile),
    });
  });

  // ── POST /auth/v1/token?grant_type=refresh_token ──────────────────────
  await page.route(
    "**/auth/v1/token?grant_type=refresh_token",
    async (route) => {
      if (!authenticatedUser) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid Refresh Token" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildSessionResponse(authenticatedUser)),
      });
    }
  );

  // ── OAuth redirect (signInWithOAuth) — just capture, don't redirect ───
  await page.route("**/auth/v1/authorize*", async (route) => {
    const url = route.request().url();
    capturedRequests.oauthSignIn.push({ url });
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>OAuth redirect intercepted</body></html>",
    });
  });

  // ── POST /auth/v1/logout ──────────────────────────────────────────────
  await page.route("**/auth/v1/logout", async (route) => {
    await route.fulfill({
      status: 204,
      body: "",
    });
  });

  return {
    capturedRequests,
    capturedUrls,

    /** Override the signIn response for subsequent login attempts. */
    onSignIn(handler: (route: Route) => Promise<void>) {
      signInHandler = handler;
    },

    /** Override the signUp response. */
    onSignUp(handler: (route: Route) => Promise<void>) {
      signUpHandler = handler;
    },

    /** Override the recover (forgot password) response. */
    onRecover(handler: (route: Route) => Promise<void>) {
      recoverHandler = handler;
    },

    /** Override the updateUser (reset password) response. */
    onUpdateUser(handler: (route: Route) => Promise<void>) {
      updateUserHandler = handler;
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers to inject authenticated session into localStorage
// ---------------------------------------------------------------------------

/**
 * Seed localStorage with a valid Supabase session so the app boots as if
 * the user is already logged in. Call BEFORE page.goto().
 */
export async function seedAuthSession(page: Page, user: MockUser) {
  const session = buildSessionResponse(user);
  const storageKey = `sb-${extractProjectRef(page)}-auth-token`;
  const payload = JSON.stringify({
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  });

  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
      window.sessionStorage.setItem(key, value);
      window.localStorage.setItem("persist_session", "true");
    },
    [storageKey, payload]
  );
}

function extractProjectRef(_page: Page): string {
  // The Supabase client key includes the project ref in the URL.
  // For mocking we use a fixed ref; it doesn't matter as long as
  // it matches what the client looks for in storage.
  // Supabase storage key format: sb-<project-ref>-auth-token
  // We'll use a wildcard approach in the init script instead.
  return "*";
}

/**
 * Seed localStorage with a Supabase session for any project ref.
 * Uses supabaseUrl (e.g. from env) to derive storage key so the app finds the session.
 * If storageKeys are provided, those are used; otherwise keys are derived from supabaseUrl.
 */
export async function seedAuthSessionUniversal(
  page: Page,
  user: MockUser,
  supabaseUrlOrKeys?: string | string[]
) {
  const session = buildSessionResponse(user);
  const payload = JSON.stringify({
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  });

  const keys: string[] = Array.isArray(supabaseUrlOrKeys)
    ? supabaseUrlOrKeys
    : supabaseUrlOrKeys && supabaseUrlOrKeys.startsWith("http")
      ? [`sb-${new URL(supabaseUrlOrKeys).hostname.split(".")[0]}-auth-token`, "sb-mock-auth-token"]
      : ["sb-mock-auth-token"];

  await page.addInitScript(
    (value: string, storageKeys: string[]) => {
      storageKeys.forEach((key) => {
        window.localStorage.setItem(key, value);
        window.sessionStorage.setItem(key, value);
      });
      window.localStorage.setItem("persist_session", "true");
      window.localStorage.setItem("orbit_persist_session", "true");
    },
    payload,
    keys
  );
}
