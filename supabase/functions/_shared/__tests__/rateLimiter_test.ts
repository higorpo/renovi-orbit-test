import { assertEquals } from "std/testing/asserts";
import { checkRateLimitWithDeps, type RateLimitDeps } from "../rateLimiter.ts";

function makeDeps(
  handler: RateLimitDeps["rpc"],
): RateLimitDeps {
  return { rpc: handler };
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
