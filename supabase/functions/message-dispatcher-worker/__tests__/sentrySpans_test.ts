import { assertEquals } from "std/testing/asserts";
import { isSentryEnabled, withSpan } from "../../_shared/sentrySpans.ts";

Deno.test("withSpan executes callback when Sentry is disabled", async () => {
  const prev = Deno.env.get("SENTRY_DSN");
  Deno.env.delete("SENTRY_DSN");

  try {
    assertEquals(isSentryEnabled(), false);
    const value = await withSpan("checkout", "queue", {}, async () => 42);
    assertEquals(value, 42);
  } finally {
    if (prev !== undefined) Deno.env.set("SENTRY_DSN", prev);
  }
});
