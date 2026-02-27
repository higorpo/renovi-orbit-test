/**
 * Custom Playwright fixture that extends the base `test` with Supabase
 * mock helpers pre-installed for every auth-related test.
 */
import { test as base, type Page } from "@playwright/test";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Resolve project root from this file (e2e/fixtures/auth.fixture.ts) so .env is found regardless of cwd
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");

// Load VITE_SUPABASE_URL from .env or .env.local so seedSession uses the same storage key as the app
// Match Vite's env loading order: .env, .env.local, .env.[mode], .env.[mode].local (mode = development for dev server)
function loadSupabaseUrl(): string | undefined {
  const roots = [PROJECT_ROOT, process.cwd()].filter(
    (r, i, a) => a.indexOf(r) === i
  );
  const envFiles = [
    ".env.development.local",
    ".env.development",
    ".env.local",
    ".env",
  ];
  for (const dir of roots) {
    for (const file of envFiles) {
      const filePath = join(dir, file);
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, "utf-8");
          const m = content.match(/VITE_SUPABASE_URL\s*=\s*(.+?)(?:\s*#|$)/m);
          if (m) return m[1].trim().replace(/^["']|["']$/g, "");
        } catch {
          // ignore
        }
      }
    }
  }
  return process.env.VITE_SUPABASE_URL;
}

function getStorageKeysForSeed(): string[] {
  const url = loadSupabaseUrl();
  const keys: string[] = [];
  if (url && url.startsWith("http")) {
    try {
      keys.push(`sb-${new URL(url).hostname.split(".")[0]}-auth-token`);
    } catch {
      // ignore
    }
  }
  keys.push("sb-mock-auth-token");
  return keys;
}
const defaultStorageKeys = getStorageKeysForSeed();

/** True when VITE_SUPABASE_URL was found; needed for seedSession to work (same storage key as the app). */
export const hasSeededSessionSupport = defaultStorageKeys.length > 1;

import {
  installSupabaseMocks,
  createMockUser,
  createMockProfile,
  seedAuthSessionUniversal,
  buildSessionResponse,
  type MockUser,
  type MockProfile,
  type SupabaseMockOptions,
} from "../mocks/supabase.mock";

const E2E_STORAGE_KEY = "__E2E_SUPABASE_STORAGE_KEY__";

export interface AuthFixtures {
  /** Install Supabase route mocks for a guest (no active session). */
  mockSupabaseAsGuest: () => ReturnType<typeof installSupabaseMocks>;
  /** Install Supabase route mocks with an authenticated user. */
  mockSupabaseAsUser: (
    user?: Partial<MockUser>,
    profile?: Partial<MockProfile>
  ) => ReturnType<typeof installSupabaseMocks>;
  /** Seed localStorage so the app boots already authenticated. */
  seedSession: (user?: Partial<MockUser>) => Promise<void>;
}

export const test = base.extend<AuthFixtures>({
  mockSupabaseAsGuest: async ({ page }, use) => {
    const factory = () => installSupabaseMocks(page);
    await use(factory);
  },

  mockSupabaseAsUser: async ({ page }, use) => {
    const factory = (
      userOverrides?: Partial<MockUser>,
      profileOverrides?: Partial<MockProfile>
    ) => {
      const user = createMockUser(userOverrides);
      const profile = createMockProfile({
        id: user.id,
        role: user.role as MockProfile["role"],
        full_name: user.full_name,
        ...profileOverrides,
      });
      return installSupabaseMocks(page, {
        authenticatedUser: user,
        profile,
      });
    };
    await use(factory);
  },

  seedSession: async ({ page }, use) => {
    const seeder = async (overrides?: Partial<MockUser>) => {
      const user = createMockUser(overrides);
      // Load app once to read the real storage key (same as Supabase client)
      installSupabaseMocks(page);
      await page.goto("/login");
      await page
        .waitForFunction(
          (k) => (window as unknown as Record<string, string | undefined>)[k] !== undefined,
          E2E_STORAGE_KEY,
          { timeout: 10000 }
        )
        .catch(() => null);
      const key = await page
        .evaluate((k) => (window as unknown as Record<string, string | undefined>)[k], E2E_STORAGE_KEY)
        .catch(() => undefined);
      const keys = key ? [key, "sb-mock-auth-token"] : defaultStorageKeys;
      if (!key && defaultStorageKeys.length <= 1) {
        throw new Error(
          "seedSession: app did not expose storage key. Ensure VITE_SUPABASE_URL is set when running the dev server."
        );
      }
      // Set session in current page storage so next navigation sees it (same origin)
      const payloadStr = JSON.stringify(buildSessionResponse(user));
      await seedAuthSessionUniversal(page, user, keys);
      await page.evaluate(
        ({ storageKeys, payload }: { storageKeys: string[]; payload: string }) => {
          storageKeys.forEach((k) => {
            window.localStorage.setItem(k, payload);
            window.sessionStorage.setItem(k, payload);
          });
          window.localStorage.setItem("persist_session", "true");
          window.localStorage.setItem("renovi_persist_session", "true");
        },
        { storageKeys: keys, payload: payloadStr }
      );
    };
    await use(seeder);
  },
});

export { expect } from "@playwright/test";
