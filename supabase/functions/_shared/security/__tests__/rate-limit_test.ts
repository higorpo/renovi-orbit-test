import { assertEquals } from "std/testing/asserts";
import { checkIPRateLimitWithDeps } from "../rate-limit.ts";

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
