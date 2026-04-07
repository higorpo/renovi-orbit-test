import { defineConfig, devices } from "@playwright/test";
import { applyE2eEnv } from "./e2e/load-e2e-env.mjs";

// Same .env merge for this process (workers / webServer). Global setup runs separately — it calls applyE2eEnv too.
applyE2eEnv();

const BASE_URL = "http://localhost:5173";

/** Specs that use injected Supabase session (storageState) — excluded from default browser projects. */
const MY_ACCOUNT_IGNORE = [
  "**/my-account-client.spec.ts",
  "**/my-account-provider.spec.ts",
  "**/*.setup.ts",
];

const browserProjects = [
  { name: "desktop-chromium", device: devices["Desktop Chrome"] },
  { name: "mobile-chrome", device: devices["Pixel 7"] },
  { name: "mobile-safari", device: devices["iPhone 14"] },
] as const;

export default defineConfig({
  globalSetup: "./e2e/global-setup.mjs",
  globalTeardown: "./e2e/global-teardown.mjs",
  testDir: "./e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Real Supabase My Account projects share one seeded user per role; parallel workers run different
  // browser projects at once and race on the same rows (e.g. offered_services). Override: PW_WORKERS=4.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 1,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "setup-my-account-client", testMatch: "**/my-account-client.setup.ts" },
    { name: "setup-my-account-provider", testMatch: "**/my-account-provider.setup.ts" },
    ...browserProjects.map((b) => ({
      name: b.name,
      testIgnore: [...MY_ACCOUNT_IGNORE],
      use: { ...b.device },
    })),
    ...browserProjects.flatMap((b) => [
      {
        name: `${b.name}-my-account-client`,
        dependencies: ["setup-my-account-client"],
        testMatch: "**/my-account-client.spec.ts" as const,
        use: {
          ...b.device,
          storageState: "e2e/.auth/my-account-client.json",
        },
      },
      {
        name: `${b.name}-my-account-provider`,
        dependencies: ["setup-my-account-provider"],
        testMatch: "**/my-account-provider.spec.ts" as const,
        use: {
          ...b.device,
          storageState: "e2e/.auth/my-account-provider.json",
        },
      },
    ]),
  ],

  webServer: {
    command: "yarn dev:vite",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
