/**
 * Builds the full URL for a provider's public profile.
 * Uses window.location.origin in the browser; accepts baseUrl for SSR or tests.
 */
export function buildProfileUrl(slug: string, baseUrl?: string): string {
  const base = typeof baseUrl === "string" ? baseUrl : (typeof window !== "undefined" ? window.location.origin : "");
  const path = `/perfil/${encodeURIComponent(slug)}`;
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}

/**
 * Path only (no origin) for router or links.
 */
export function getProviderProfilePath(slug: string): string {
  return `/perfil/${encodeURIComponent(slug)}`;
}
