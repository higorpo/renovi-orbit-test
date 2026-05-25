import { assertEquals } from "std/testing/asserts";
import { clampCheckoutLimit, parseCheckoutBatch } from "../checkout.ts";

Deno.test("clampCheckoutLimit enforces 1..50", () => {
  assertEquals(clampCheckoutLimit(undefined), 25);
  assertEquals(clampCheckoutLimit(0), 1);
  assertEquals(clampCheckoutLimit(100), 50);
});

Deno.test("parseCheckoutBatch accepts RPC jsonb array", () => {
  const items = parseCheckoutBatch([
    {
      id: "550e8400-e29b-41d4-a716-446655440000",
      profile_id: "550e8400-e29b-41d4-a716-446655440001",
      channel: "email",
      template_key: "welcome_template",
      template_variables: {},
      correlation_id: "550e8400-e29b-41d4-a716-446655440002",
      status: "PROCESSING",
      locked_until: "2026-01-01T00:00:00Z",
      locked_by: "worker-1",
      recipient_email: "a@b.com",
      deliveries: [],
    },
  ]);
  assertEquals(items.length, 1);
  assertEquals(items[0].channel, "email");
});
