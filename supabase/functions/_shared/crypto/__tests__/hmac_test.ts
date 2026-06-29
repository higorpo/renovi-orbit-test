import { assertEquals } from "std/testing/asserts";
import { computeHMACSHA256 } from "../hmac.ts";

Deno.test("computeHMACSHA256 is deterministic for same secret and message", async () => {
  const first = await computeHMACSHA256("secret", "payload");
  const second = await computeHMACSHA256("secret", "payload");
  assertEquals(first, second);
  assertEquals(first.length, 64);
});

Deno.test("computeHMACSHA256 changes when message changes", async () => {
  const first = await computeHMACSHA256("secret", "payload-a");
  const second = await computeHMACSHA256("secret", "payload-b");
  assertEquals(first === second, false);
});
