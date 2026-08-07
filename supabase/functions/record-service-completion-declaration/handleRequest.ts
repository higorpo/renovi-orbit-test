/**
 * Edge Function: record-service-completion-declaration
 *
 * Persists client execution declaration (IP + device metadata + approximate IP geo).
 * Calls SECURITY DEFINER RPC with the caller's JWT so ownership is enforced.
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import { createLogger } from "../_shared/logger.ts";
import { checkRateLimit, getClientIP } from "../_shared/rateLimiter.ts";

const logger = createLogger("record-service-completion-declaration");
const RATE_LIMIT_CONFIG = { perMinute: 30, failClosed: true };
const IP_GEO_TIMEOUT_MS = 2_000;
// ipwho.is free: 1,000 req/day shared by Edge egress IP. Upgrade paid plan when
// declaration volume exceeds that; 429/errors → ip_geo null (declaration still OK).
// See docs/service-completion/adr/0005-execution-declaration-audit-trail.md.

export type IpGeoPayload = {
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
};

export type DeviceDeclarationFields = {
  deviceId?: string | null;
  platform?: string | null;
  operatingSystem?: string | null;
  osVersion?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  deviceName?: string | null;
  isVirtual?: boolean | null;
  webViewVersion?: string | null;
  userAgent?: string | null;
  clientTimezone?: string | null;
};

export type UpsertExecutionDeclarationParams = DeviceDeclarationFields & {
  contractedServiceId: string;
  clientIp: string | null;
  ipGeo: IpGeoPayload | null;
};

export type RecordDeclarationDeps = {
  getUser: (
    token: string,
  ) => Promise<{ user: { id: string } | null; error: Error | null }>;
  lookupIpGeo: (ip: string) => Promise<IpGeoPayload | null>;
  upsertDeclaration: (
    authHeader: string,
    params: UpsertExecutionDeclarationParams,
  ) => Promise<{
    data: Record<string, unknown> | null;
    error: { message: string; code?: string } | null;
  }>;
  checkRateLimit: typeof checkRateLimit;
};

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function parseRecordDeclarationBody(
  body: unknown,
): { ok: true; contractedServiceId: string; device: DeviceDeclarationFields } | {
  ok: false;
  error: string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_body" };
  }
  const record = body as Record<string, unknown>;
  const contractedServiceId = asOptionalString(
    record.contractedServiceId ?? record.contracted_service_id,
  );
  if (!contractedServiceId) {
    return { ok: false, error: "contracted_service_id_required" };
  }

  return {
    ok: true,
    contractedServiceId,
    device: {
      deviceId: asOptionalString(record.deviceId ?? record.device_id),
      platform: asOptionalString(record.platform),
      operatingSystem: asOptionalString(
        record.operatingSystem ?? record.operating_system,
      ),
      osVersion: asOptionalString(record.osVersion ?? record.os_version),
      manufacturer: asOptionalString(record.manufacturer),
      model: asOptionalString(record.model),
      deviceName: asOptionalString(record.deviceName ?? record.device_name),
      isVirtual: asOptionalBoolean(record.isVirtual ?? record.is_virtual),
      webViewVersion: asOptionalString(
        record.webViewVersion ?? record.web_view_version,
      ),
      userAgent: asOptionalString(record.userAgent ?? record.user_agent),
      clientTimezone: asOptionalString(
        record.clientTimezone ?? record.client_timezone,
      ),
    },
  };
}

export async function lookupIpWhoIs(
  ip: string,
  fetchImpl: typeof fetch = fetch,
): Promise<IpGeoPayload | null> {
  const normalized = ip.trim();
  if (!normalized || normalized === "unknown") {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IP_GEO_TIMEOUT_MS);
  try {
    const response = await fetchImpl(
      `https://ipwho.is/${encodeURIComponent(normalized)}`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json() as {
      success?: boolean;
      country?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
    };
    if (!data?.success) {
      return null;
    }
    return {
      country: typeof data.country === "string" ? data.country : null,
      region: typeof data.region === "string" ? data.region : null,
      city: typeof data.city === "string" ? data.city : null,
      latitude: typeof data.latitude === "number" ? data.latitude : null,
      longitude: typeof data.longitude === "number" ? data.longitude : null,
      source: "ipwho.is",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function handleRecordDeclarationRequest(
  req: Request,
  deps: RecordDeclarationDeps,
): Promise<Response> {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401, cors);
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return jsonResponse({ error: "Unauthorized" }, 401, cors);
  }

  const { user, error: authError } = await deps.getUser(token);
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401, cors);
  }

  const clientIP = getClientIP(req);
  const rateLimit = await deps.checkRateLimit(
    clientIP,
    user.id,
    "record-service-completion-declaration",
    RATE_LIMIT_CONFIG,
  );

  if (!rateLimit.allowed) {
    logger.warn("rate_limited", {
      user_id: user.id,
      retry_after: rateLimit.retryAfter,
    });
    return jsonResponse(
      {
        error: "rate_limited",
        message: "Too many requests. Try again shortly.",
        retryAfter: rateLimit.retryAfter,
      },
      429,
      {
        ...cors,
        "Retry-After": String(rateLimit.retryAfter || 60),
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, cors);
  }

  const parsed = parseRecordDeclarationBody(body);
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, 400, cors);
  }

  const ipForLookup = clientIP === "unknown" ? "" : clientIP;
  const ipGeo = ipForLookup ? await deps.lookupIpGeo(ipForLookup) : null;

  const { data, error } = await deps.upsertDeclaration(authHeader, {
    contractedServiceId: parsed.contractedServiceId,
    clientIp: ipForLookup || null,
    ipGeo,
    ...parsed.device,
  });

  if (error) {
    const message = error.message || "upsert_failed";
    const isAuthz =
      message.includes("SERVICE_NOT_FOUND_OR_UNAUTHORIZED") ||
      error.code === "P0003" ||
      error.code === "42501";
    const isConflict =
      message.includes("INVALID_STATUS_TRANSITION") || error.code === "P0001";

    logger.warn("upsert_execution_declaration_failed", {
      user_id: user.id,
      contracted_service_id: parsed.contractedServiceId,
      code: error.code,
      error: message,
    });

    return jsonResponse(
      { error: message, code: error.code ?? null },
      isAuthz ? 403 : isConflict ? 409 : 400,
      cors,
    );
  }

  return jsonResponse(
    {
      ok: true,
      id: data?.id ?? null,
      contractedServiceId: parsed.contractedServiceId,
      declaredAt: data?.declared_at ?? null,
      lastSeenAt: data?.last_seen_at ?? null,
    },
    200,
    cors,
  );
}

export function createRecordDeclarationDeps(): RecordDeclarationDeps {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRole = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  return {
    getUser: async (token) => {
      const { data: { user }, error } = await serviceRole.auth.getUser(token);
      return { user, error: error ?? null };
    },
    lookupIpGeo: (ip) => lookupIpWhoIs(ip),
    upsertDeclaration: async (authHeader, params) => {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await userClient.rpc(
        "service_completion_upsert_execution_declaration",
        {
          p_contracted_service_id: params.contractedServiceId,
          p_client_ip: params.clientIp,
          p_ip_geo: params.ipGeo,
          p_device_id: params.deviceId ?? null,
          p_platform: params.platform ?? null,
          p_operating_system: params.operatingSystem ?? null,
          p_os_version: params.osVersion ?? null,
          p_manufacturer: params.manufacturer ?? null,
          p_model: params.model ?? null,
          p_device_name: params.deviceName ?? null,
          p_is_virtual: params.isVirtual ?? null,
          p_web_view_version: params.webViewVersion ?? null,
          p_user_agent: params.userAgent ?? null,
          p_client_timezone: params.clientTimezone ?? null,
        },
      );
      return {
        data: (data as Record<string, unknown> | null) ?? null,
        error: error ? { message: error.message, code: error.code } : null,
      };
    },
    checkRateLimit,
  };
}
