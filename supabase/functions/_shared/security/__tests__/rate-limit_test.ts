import { assertEquals } from "std/testing/asserts";
import {
  checkIPRateLimit,
  checkIPRateLimitWithDeps,
  DEFAULT_WEBHOOK_IP_RATE_LIMIT_PER_MINUTE,
  emitIPRateLimitWarning,
} from "../rate-limit.ts";

Deno.test("checkIPRateLimitWithDeps defaults to fail-closed on RPC error", async () => {
  const result = await checkIPRateLimitWithDeps(
    "1.2.3.4",
    "netcred-webhook",
    { perMinute: 120 },
    {
      rpc: async () => ({ data: null, error: { message: "db down" } }),
    },
  );

  assertEquals(result.allowed, false);
  assertEquals(result.retryAfter, 60);
});

Deno.test("checkIPRateLimitWithDeps fail-open when explicitly configured", async () => {
  const result = await checkIPRateLimitWithDeps(
    "1.2.3.4",
    "netcred-webhook",
    { perMinute: 120, failClosed: false },
    {
      rpc: async () => ({ data: null, error: { message: "db down" } }),
    },
  );

  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 120);
});

Deno.test("checkIPRateLimitWithDeps uses default perMinute when omitted", async () => {
  const result = await checkIPRateLimitWithDeps(
    "1.2.3.4",
    "netcred-webhook",
    {},
    {
      rpc: async () => ({ data: null, error: { message: "db down" } }),
    },
  );

  assertEquals(result.allowed, false);
  assertEquals(DEFAULT_WEBHOOK_IP_RATE_LIMIT_PER_MINUTE, 120);
});

Deno.test("checkIPRateLimit fail-closed when service role client cannot be created", async () => {
  const prevUrl = Deno.env.get("SUPABASE_URL");
  const prevKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

  try {
    const result = await checkIPRateLimit("1.2.3.4", "netcred-webhook", {
      perMinute: 90,
    });
    assertEquals(result.allowed, false);
    assertEquals(result.remaining, 0);
    assertEquals(result.retryAfter, 60);
  } finally {
    if (prevUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", prevUrl);
    if (prevKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prevKey);
  }
});

Deno.test("checkIPRateLimit fail-open when client creation fails and failClosed is false", async () => {
  const prevUrl = Deno.env.get("SUPABASE_URL");
  const prevKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");

  try {
    const result = await checkIPRateLimit("1.2.3.4", "netcred-webhook", {
      failClosed: false,
    });
    assertEquals(result.allowed, true);
    assertEquals(result.remaining, DEFAULT_WEBHOOK_IP_RATE_LIMIT_PER_MINUTE);
    assertEquals(result.retryAfter, 0);
  } finally {
    if (prevUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", prevUrl);
    if (prevKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prevKey);
  }
});

Deno.test("emitIPRateLimitWarning does not throw when Sentry is unavailable", async () => {
  const prev = Deno.env.get("SENTRY_DSN");
  Deno.env.delete("SENTRY_DSN");
  try {
    await emitIPRateLimitWarning({
      endpoint: "netcred-webhook",
      sourceIp: "1.2.3.4",
      retryAfter: 30,
    });
  } finally {
    if (prev !== undefined) Deno.env.set("SENTRY_DSN", prev);
  }
});

Deno.test("checkIPRateLimit uses service role client when env is configured", async () => {
  const prevUrl = Deno.env.get("SUPABASE_URL");
  const prevKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  // Unreachable local port — client constructs, RPC fails fast without real network dependency.
  Deno.env.set("SUPABASE_URL", "http://127.0.0.1:1");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

  try {
    const result = await checkIPRateLimit("9.9.9.9", "netcred-webhook", {
      perMinute: 10,
      failClosed: true,
    });
    assertEquals(result.allowed, false);
    assertEquals(result.retryAfter, 60);
  } finally {
    if (prevUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", prevUrl);
    if (prevKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prevKey);
  }
});

Deno.test("checkIPRateLimitWithDeps maps successful RPC payload", async () => {
  const result = await checkIPRateLimitWithDeps(
    "1.2.3.4",
    "netcred-webhook",
    { perMinute: 50 },
    {
      rpc: async () => ({
        data: { allowed: true, remaining: 49, retry_after: 0 },
        error: null,
      }),
    },
  );

  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 49);
  assertEquals(result.retryAfter, 0);
});
