import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { MyAccountPage } from "../pages/my-account.page";

/** Navigate to /dashboard/conta when the context already has a valid Supabase session (storageState). */
export async function openMyAccountLoggedIn(page: Page) {
  const acc = new MyAccountPage(page);
  await acc.goto();
  await expect(acc.getPageHeading()).toBeVisible({ timeout: 20_000 });
  // Heading renders before the form; wait for the first field so we are past the loading skeleton.
  await expect(acc.getFullNameInput()).toBeVisible({ timeout: 30_000 });
}
