/**
 * Rate Limiter Module for Supabase Edge Functions
 *
 * Uses atomic RPC public.platform_check_rate_limit (SELECT FOR UPDATE).
 * Cost-sensitive functions should set failClosed: true to deny on DB/client errors.
 */

import { createServiceRoleClient } from "./serviceRoleClient.ts";

export interface RateLimitConfig {
  perMinute: number;
  burst?: number;
  blockDuration?: number;
  attackBlockDuration?: number;
  /** When true, deny requests if rate-limit storage is unavailable (AI, upload, order). */
  failClosed?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

export interface RateLimitRpcPayload {
  allowed?: boolean;
  remaining?: number;
  retry_after?: number;
}

export interface RateLimitDeps {
  rpc: (
    params: { p_key: string; p_per_minute: number; p_window_ms: number },
  ) => Promise<{ data: RateLimitRpcPayload | null; error: { message: string } | null }>;
}

const WINDOW_MS = 60_000;
const FAIL_CLOSED_RETRY_AFTER_SEC = 60;

function failOpenResult(perMinute: number): RateLimitResult {
  return { allowed: true, remaining: perMinute, retryAfter: 0 };
}

function failClosedResult(): RateLimitResult {
  return { allowed: false, remaining: 0, retryAfter: FAIL_CLOSED_RETRY_AFTER_SEC };
}

function parseRpcPayload(
  data: RateLimitRpcPayload | null,
  perMinute: number,
  failClosed: boolean,
): RateLimitResult {
  if (!data || typeof data.allowed !== "boolean") {
    return failClosed ? failClosedResult() : failOpenResult(perMinute);
  }

  return {
    allowed: data.allowed,
    remaining: typeof data.remaining === "number" ? data.remaining : 0,
    retryAfter: typeof data.retry_after === "number" ? data.retry_after : 0,
  };
}

export async function checkRateLimitWithDeps(
  ip: string | null,
  userId: string | null,
  functionName: string,
  config: RateLimitConfig,
  deps: RateLimitDeps,
): Promise<RateLimitResult> {
  const perMinute = config.perMinute || 60;
  const failClosed = config.failClosed === true;
  const uniqueKey = `${functionName}:${userId ?? ip ?? "anonymous"}`;

  try {
    const { data, error } = await deps.rpc({
      p_key: uniqueKey,
      p_per_minute: perMinute,
      p_window_ms: WINDOW_MS,
    });

    if (error) {
      return failClosed ? failClosedResult() : failOpenResult(perMinute);
    }

    return parseRpcPayload(data, perMinute, failClosed);
  } catch {
    return failClosed ? failClosedResult() : failOpenResult(perMinute);
  }
}

export async function checkRateLimit(
  ip: string | null,
  userId: string | null,
  functionName: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return config.failClosed === true
      ? failClosedResult()
      : failOpenResult(config.perMinute || 60);
  }

  return checkRateLimitWithDeps(ip, userId, functionName, config, {
    rpc: (params) => supabase.rpc("platform_check_rate_limit", params),
  });
}

export function getClientIP(req: Request): string {
  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  if (cfConnectingIP) return cfConnectingIP;
  const xRealIP = req.headers.get("x-real-ip");
  if (xRealIP) return xRealIP;
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) return xForwardedFor.split(",").map((ip) => ip.trim())[0] ?? "unknown";
  const trueClientIP = req.headers.get("true-client-ip");
  if (trueClientIP) return trueClientIP;
  return "unknown";
}

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const supabase = createServiceRoleClient();
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}
