import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test as setup, expect } from "@playwright/test";
import { LoginPage } from "../pages/login.page";
import { getSettingsProviderCredentials } from "../pages/settings.page";

const authDir = join(dirname(fileURLToPath(import.meta.url)), "../.auth");
const storagePath = join(authDir, "settings-provider.json");

setup("authenticate My Account E2E provider user", async ({ page }) => {
  mkdirSync(authDir, { recursive: true });
  const c = getSettingsProviderCredentials();
  const login = new LoginPage(page);
  await login.goto();
  await login.login(c.email, c.password);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 25_000 });
  await page.context().storageState({ path: storagePath });
});
