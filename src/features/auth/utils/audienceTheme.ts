import type { ProfileRole } from "../types/auth.types";

export type AudienceTheme = "client" | "provider";

/**
 * Maps profile role → audience theme for CSS `data-audience`.
 * Admin and logged-out users fall back to client (brand-blue).
 */
export function resolveAudienceTheme(
  role: ProfileRole | null | undefined
): AudienceTheme {
  return role === "provider" ? "provider" : "client";
}

/**
 * Syncs `document.documentElement.dataset.audience` so Tailwind
 * `audience-*` tokens resolve to brand-blue (#2563EB) for clients or
 * brand-orange (#F97316) for providers. Primary stays black. See `src/index.css`.
 */
export function syncAudienceTheme(role: ProfileRole | null | undefined): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.audience = resolveAudienceTheme(role);
}
