/**
 * Custom Playwright fixture that extends the base `test` with Supabase
 * mock helpers pre-installed for every auth-related test.
 */
import { test as base, type Page } from "@playwright/test";
import {
  installSupabaseMocks,
  createMockUser,
  createMockProfile,
  seedAuthSessionUniversal,
  type MockUser,
  type MockProfile,
  type SupabaseMockOptions,
} from "../mocks/supabase.mock";

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
      await seedAuthSessionUniversal(page, user);
    };
    await use(seeder);
  },
});

export { expect } from "@playwright/test";
