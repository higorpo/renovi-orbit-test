import { assertEquals } from "std/testing/asserts";
import {
  checkRateLimit,
  checkRateLimitWithDeps,
  getClientIP,
  getUserIdFromRequest,
  type RateLimitDeps,
} from "../rateLimiter.ts";

function makeDeps(
  handler: RateLimitDeps["rpc"],
): RateLimitDeps {
  return { rpc: handler };
}

function withMissingServiceRoleEnv<T>(fn: () => T | Promise<T>): Promise<T> {
  const prevUrl = Deno.env.get("SUPABASE_URL");
  const prevKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prevUrl === undefined) Deno.env.delete("SUPABASE_URL");
      else Deno.env.set("SUPABASE_URL", prevUrl);
      if (prevKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
      else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prevKey);
    });
}

Deno.test("checkRateLimitWithDeps fail-open allows when RPC errors", async () => {
  const result = await checkRateLimitWithDeps(
    "1.2.3.4",
    null,
    "list-provider-opportunities",
    { perMinute: 60 },
    makeDeps(async () => ({ data: null, error: { message: "db down" } })),
  );

  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 60);
});

Deno.test("checkRateLimitWithDeps fail-closed denies when RPC errors", async () => {
  const result = await checkRateLimitWithDeps(
    "1.2.3.4",
    "user-1",
    "generate-smart-description",
    { perMinute: 60, failClosed: true },
    makeDeps(async () => ({ data: null, error: { message: "db down" } })),
  );

  assertEquals(result.allowed, false);
  assertEquals(result.retryAfter, 60);
});

Deno.test("checkRateLimitWithDeps maps RPC payload", async () => {
  const result = await checkRateLimitWithDeps(
    "1.2.3.4",
    "user-1",
    "chat-upload-media",
    { perMinute: 30, failClosed: true },
    makeDeps(async () => ({
      data: { allowed: false, remaining: 0, retry_after: 12 },
      error: null,
    })),
  );

  assertEquals(result.allowed, false);
  assertEquals(result.remaining, 0);
  assertEquals(result.retryAfter, 12);
});

Deno.test("checkRateLimitWithDeps fail-open on malformed RPC payload", async () => {
  const result = await checkRateLimitWithDeps(
    "1.2.3.4",
    null,
    "fn",
    { perMinute: 40 },
    makeDeps(async () => ({ data: { remaining: 3 }, error: null })),
  );

  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 40);
  assertEquals(result.retryAfter, 0);
});

Deno.test("checkRateLimitWithDeps fail-closed on null RPC payload", async () => {
  const result = await checkRateLimitWithDeps(
    "1.2.3.4",
    null,
    "fn",
    { perMinute: 40, failClosed: true },
    makeDeps(async () => ({ data: null, error: null })),
  );

  assertEquals(result.allowed, false);
  assertEquals(result.remaining, 0);
  assertEquals(result.retryAfter, 60);
});

Deno.test("checkRateLimitWithDeps defaults non-numeric remaining and retry_after", async () => {
  const result = await checkRateLimitWithDeps(
    null,
    "user-1",
    "fn",
    { perMinute: 10 },
    makeDeps(async () => ({
      data: {
        allowed: true,
        remaining: "x" as unknown as number,
        retry_after: null as unknown as number,
      },
      error: null,
    })),
  );

  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 0);
  assertEquals(result.retryAfter, 0);
});

Deno.test("checkRateLimitWithDeps fail-open when rpc throws", async () => {
  const result = await checkRateLimitWithDeps(
    "1.2.3.4",
    null,
    "fn",
    { perMinute: 15 },
    makeDeps(async () => {
      throw new Error("boom");
    }),
  );

  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 15);
});

Deno.test("checkRateLimitWithDeps fail-closed when rpc throws", async () => {
  const result = await checkRateLimitWithDeps(
    "1.2.3.4",
    null,
    "fn",
    { perMinute: 15, failClosed: true },
    makeDeps(async () => {
      throw new Error("boom");
    }),
  );

  assertEquals(result.allowed, false);
  assertEquals(result.retryAfter, 60);
});

Deno.test("checkRateLimitWithDeps defaults perMinute to 60 when unset", async () => {
  const result = await checkRateLimitWithDeps(
    "1.2.3.4",
    null,
    "fn",
    { perMinute: 0 },
    makeDeps(async () => ({ data: null, error: { message: "db" } })),
  );

  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 60);
});

Deno.test("checkRateLimit fail-open when service role client cannot be created", async () => {
  const result = await withMissingServiceRoleEnv(() =>
    checkRateLimit("1.2.3.4", null, "fn", { perMinute: 25 })
  );

  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 25);
});

Deno.test("checkRateLimit fail-closed when service role client cannot be created", async () => {
  const result = await withMissingServiceRoleEnv(() =>
    checkRateLimit("1.2.3.4", null, "fn", { perMinute: 25, failClosed: true })
  );

  assertEquals(result.allowed, false);
  assertEquals(result.retryAfter, 60);
});

Deno.test("getClientIP prefers cf-connecting-ip", () => {
  const req = new Request("https://example.com", {
    headers: {
      "cf-connecting-ip": "10.0.0.1",
      "x-real-ip": "10.0.0.2",
      "x-forwarded-for": "10.0.0.3",
    },
  });
  assertEquals(getClientIP(req), "10.0.0.1");
});

Deno.test("getClientIP falls back to x-real-ip", () => {
  const req = new Request("https://example.com", {
    headers: {
      "x-real-ip": "10.0.0.2",
      "x-forwarded-for": "10.0.0.3",
    },
  });
  assertEquals(getClientIP(req), "10.0.0.2");
});

Deno.test("getClientIP uses first x-forwarded-for hop", () => {
  const req = new Request("https://example.com", {
    headers: { "x-forwarded-for": " 10.0.0.3 , 10.0.0.4 " },
  });
  assertEquals(getClientIP(req), "10.0.0.3");
});

Deno.test("getClientIP falls back to true-client-ip", () => {
  const req = new Request("https://example.com", {
    headers: { "true-client-ip": "10.0.0.5" },
  });
  assertEquals(getClientIP(req), "10.0.0.5");
});

Deno.test("getClientIP returns unknown when no IP headers", () => {
  const req = new Request("https://example.com");
  assertEquals(getClientIP(req), "unknown");
});

Deno.test("getUserIdFromRequest returns null without Bearer auth", async () => {
  const req = new Request("https://example.com", {
    headers: { Authorization: "Basic abc" },
  });
  assertEquals(await getUserIdFromRequest(req), null);
});

Deno.test("getUserIdFromRequest returns null when Authorization is missing", async () => {
  const req = new Request("https://example.com");
  assertEquals(await getUserIdFromRequest(req), null);
});

Deno.test("getUserIdFromRequest returns null when service role client cannot be created", async () => {
  const result = await withMissingServiceRoleEnv(() =>
    getUserIdFromRequest(
      new Request("https://example.com", {
        headers: { Authorization: "Bearer some-token" },
      }),
    )
  );
  assertEquals(result, null);
});

Deno.test("checkRateLimit uses service role client when env is configured", async () => {
  const prevUrl = Deno.env.get("SUPABASE_URL");
  const prevKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_URL", "http://127.0.0.1:1");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

  try {
    const result = await checkRateLimit("1.2.3.4", "user-1", "fn", {
      perMinute: 20,
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

Deno.test("checkRateLimit fail-open defaults perMinute when client creation fails", async () => {
  const result = await withMissingServiceRoleEnv(() =>
    checkRateLimit("1.2.3.4", null, "fn", { perMinute: 0 })
  );
  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 60);
});

Deno.test("checkRateLimitWithDeps uses anonymous key when ip and userId are null", async () => {
  let capturedKey = "";
  const result = await checkRateLimitWithDeps(
    null,
    null,
    "fn",
    { perMinute: 5 },
    makeDeps(async (params) => {
      capturedKey = params.p_key;
      return {
        data: { allowed: true, remaining: 4, retry_after: 0 },
        error: null,
      };
    }),
  );

  assertEquals(capturedKey, "fn:anonymous");
  assertEquals(result.allowed, true);
  assertEquals(result.remaining, 4);
});

Deno.test("getUserIdFromRequest returns null when auth.getUser fails against unreachable host", async () => {
  const prevUrl = Deno.env.get("SUPABASE_URL");
  const prevKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_URL", "http://127.0.0.1:1");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

  try {
    const result = await getUserIdFromRequest(
      new Request("https://example.com", {
        headers: { Authorization: "Bearer some-token" },
      }),
    );
    assertEquals(result, null);
  } finally {
    if (prevUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", prevUrl);
    if (prevKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", prevKey);
  }
});

Deno.test("getClientIP returns first trimmed hop even when empty", () => {
  const req = new Request("https://example.com", {
    headers: { "x-forwarded-for": "  , 10.0.0.9 " },
  });
  assertEquals(getClientIP(req), "");
});
