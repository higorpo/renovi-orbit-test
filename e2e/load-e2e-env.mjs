/**
 * Merges env vars from Vite-style .env files into process.env.
 * Playwright globalSetup/globalTeardown run in a separate Node process and do not inherit
 * playwright.config evaluation unless we load files here explicitly.
 *
 * Loaded files (mode=development): .env, .env.local, .env.development, .env.development.local
 * Only keys starting with VITE_, E2E_, or SUPABASE_ are applied (same as typical .env.local usage).
 *
 * Override mode: E2E_DOTENV_MODE=test (loads .env.test, .env.test.local, etc.)
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const E2E_PROJECT_ROOT = join(__dirname, "..");

/** Prefixes merged into process.env (service role must use SUPABASE_* or E2E_*). */
const E2E_ENV_PREFIXES = ["VITE_", "E2E_", "SUPABASE_"];

export function applyE2eEnv() {
  const mode = process.env.E2E_DOTENV_MODE || "development";
  const fromFiles = loadEnv(mode, E2E_PROJECT_ROOT, E2E_ENV_PREFIXES);
  Object.assign(process.env, fromFiles);
}
