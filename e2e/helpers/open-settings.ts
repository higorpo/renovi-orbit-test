import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { SettingsPage } from "../pages/settings.page";

/** Navigate to /dashboard/settings when the context already has a valid Supabase session (storageState). */
export async function openSettingsLoggedIn(page: Page) {
  const acc = new SettingsPage(page);
  await acc.goto();
  await expect(acc.getPageHeading()).toBeVisible({ timeout: 20_000 });
  // Heading renders before the form; wait for the first field so we are past the loading skeleton.
  await expect(acc.getFullNameInput()).toBeVisible({ timeout: 30_000 });
}
