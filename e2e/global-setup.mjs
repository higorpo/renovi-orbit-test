/**
 * Playwright global setup: seeds My Account E2E users when service role is available.
 */
import { applyE2eEnv } from "./load-e2e-env.mjs";
import { seedMyAccountE2eUsers } from "./scripts/seed-my-account-e2e-users.mjs";

applyE2eEnv();

export default async function globalSetup() {
  if (process.env.E2E_SKIP_ACCOUNT_SETUP === "1") {
    console.log("[e2e global-setup] Skipped (E2E_SKIP_ACCOUNT_SETUP=1)");
    return;
  }

  const url = process.env.VITE_SUPABASE_URL ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !serviceRole) {
    console.warn(
      "[e2e global-setup] Skipping user seed. Add to .env.local (or export): " +
        "VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "(keys must start with VITE_, E2E_, or SUPABASE_). Or run: yarn e2e:seed-my-account"
    );
    return;
  }

  await seedMyAccountE2eUsers({ url, serviceRole });
}
