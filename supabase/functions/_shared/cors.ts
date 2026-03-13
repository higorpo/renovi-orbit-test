/**
 * CORS headers with origin allowlist.
 * Set ALLOWED_ORIGINS (comma-separated) in Supabase Edge Function secrets.
 * Example: https://app.example.com,http://localhost:5173
 */

const BASE_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  if (!raw || typeof raw !== "string") return [];
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = getAllowedOrigins();
  const headers = { ...BASE_CORS_HEADERS };
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
