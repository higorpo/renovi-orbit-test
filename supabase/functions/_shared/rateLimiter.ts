/**
 * Rate Limiter Module for Supabase Edge Functions (soft version)
 *
 * - Limit by IP/user
 * - 60s window
 * - No long blocks (fail open on DB error)
 *
 * NOTE: The SELECT-then-UPDATE pattern has a TOCTOU race under concurrent
 * requests — two callers can read the same count and both increment to the
 * same value, effectively allowing one extra request through the window.
 * For this soft limiter (fail-open) the risk is acceptable. If strict
 * enforcement is needed, migrate to an atomic RPC (e.g. SELECT ... FOR UPDATE
 * or a single INSERT ... ON CONFLICT UPDATE count = count + 1 RETURNING).
 */

import { createServiceRoleClient } from "./serviceRoleClient.ts";

export interface RateLimitConfig {
  perMinute: number;
  burst?: number;
  blockDuration?: number;
  attackBlockDuration?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

const WINDOW_MS = 60_000;

export async function checkRateLimit(
  ip: string | null,
  userId: string | null,
  functionName: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return { allowed: true, remaining: config.perMinute ?? 60, retryAfter: 0 };
  }

  const now = Date.now();
  const uniqueKey = `${functionName}:${userId ?? ip ?? "anonymous"}`;
  const perMinute = config.perMinute || 60;

  try {
    const { data, error } = await supabase
      .from("platform_rate_limits")
      .select("*")
      .eq("key", uniqueKey)
      .maybeSingle();

    if (error) {
      return { allowed: true, remaining: perMinute, retryAfter: 0 };
    }

    if (!data) {
      await supabase.from("platform_rate_limits").insert({
        key: uniqueKey,
        count: 1,
        reset_at: now + WINDOW_MS,
        burst_count: 1,
        blocked_until: null,
      });
      return { allowed: true, remaining: perMinute - 1, retryAfter: 0 };
    }

    if (now > data.reset_at) {
      await supabase
        .from("platform_rate_limits")
        .update({
          count: 1,
          reset_at: now + WINDOW_MS,
          burst_count: 1,
          blocked_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq("key", uniqueKey);
      return { allowed: true, remaining: perMinute - 1, retryAfter: 0 };
    }

    const currentCount = data.count ?? 0;
    const newCount = currentCount + 1;

    if (newCount > perMinute) {
      const msLeft = Math.max(0, data.reset_at - now);
      const retryAfter = Math.ceil(msLeft / 1000);
      await supabase
        .from("platform_rate_limits")
        .update({
          count: newCount,
          burst_count: (data.burst_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("key", uniqueKey);
      return { allowed: false, remaining: 0, retryAfter };
    }

    await supabase
      .from("platform_rate_limits")
      .update({
        count: newCount,
        burst_count: (data.burst_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("key", uniqueKey);

    return { allowed: true, remaining: Math.max(0, perMinute - newCount), retryAfter: 0 };
  } catch {
    return { allowed: true, remaining: perMinute, retryAfter: 0 };
  }
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
