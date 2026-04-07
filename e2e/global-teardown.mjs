/**
 * Removes My Account E2E users from Supabase Auth after the run (cascade cleans public data).
 */
import { applyE2eEnv } from "./load-e2e-env.mjs";
import { deleteMyAccountE2eUsers } from "./scripts/seed-my-account-e2e-users.mjs";

applyE2eEnv();

export default async function globalTeardown() {
  if (process.env.E2E_SKIP_ACCOUNT_TEARDOWN === "1") {
    console.log("[e2e global-teardown] Skipped (E2E_SKIP_ACCOUNT_TEARDOWN=1)");
    return;
  }

  const url = process.env.VITE_SUPABASE_URL ?? "";
  const serviceRole =
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "";

  if (!url || !serviceRole) {
    console.warn(
      "[e2e global-teardown] Skip deleting E2E users (no VITE_SUPABASE_URL or service role key)."
    );
    return;
  }

  try {
    await deleteMyAccountE2eUsers({ url, serviceRole });
  } catch (e) {
    console.warn("[e2e global-teardown] Cleanup failed (non-fatal):", e);
  }
}
