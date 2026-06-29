import {
  checkRateLimitWithDeps,
  type RateLimitConfig,
  type RateLimitDeps,
  type RateLimitResult,
} from "../rateLimiter.ts";
import { createServiceRoleClient } from "../serviceRoleClient.ts";

export type IPRateLimitConfig = Partial<
  Pick<RateLimitConfig, "perMinute" | "failClosed">
>;

export const DEFAULT_WEBHOOK_IP_RATE_LIMIT_PER_MINUTE = 120;

export async function checkIPRateLimitWithDeps(
  ip: string,
  endpoint: string,
  config: IPRateLimitConfig,
  deps: RateLimitDeps,
): Promise<RateLimitResult> {
  const perMinute = config.perMinute ?? DEFAULT_WEBHOOK_IP_RATE_LIMIT_PER_MINUTE;

  return checkRateLimitWithDeps(ip, null, endpoint, {
    perMinute,
    failClosed: config.failClosed ?? true,
  }, deps);
}

export async function checkIPRateLimit(
  ip: string,
  endpoint: string,
  config: IPRateLimitConfig = {},
): Promise<RateLimitResult> {
  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch {
    const perMinute = config.perMinute ?? DEFAULT_WEBHOOK_IP_RATE_LIMIT_PER_MINUTE;
    return (config.failClosed ?? true)
      ? { allowed: false, remaining: 0, retryAfter: 60 }
      : { allowed: true, remaining: perMinute, retryAfter: 0 };
  }

  return checkIPRateLimitWithDeps(ip, endpoint, config, {
    rpc: (params) => supabase.rpc("platform_check_rate_limit", params),
  });
}

export async function emitIPRateLimitWarning(context: {
  endpoint: string;
  sourceIp: string;
  retryAfter: number;
}): Promise<void> {
  try {
    const Sentry = await import("@sentry/deno");
    Sentry.captureMessage("webhook_ip_rate_limit_exceeded", {
      level: "warning",
      extra: context,
    });
  } catch {
    // Sentry unavailable — non-blocking.
  }
}
