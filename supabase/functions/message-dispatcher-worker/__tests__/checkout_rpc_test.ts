import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkoutBatch, clampCheckoutLimit, parseCheckoutBatch } from "../checkout.ts";

function mockSupabaseCheckout(
  response: { data: unknown; error: { message: string } | null },
): SupabaseClient {
  return {
    schema: () => ({
      rpc: async (name: string, args: { p_limit: number; p_worker_id: string }) => {
        assertEquals(name, "message_dispatcher_checkout_batch");
        assertEquals(typeof args.p_worker_id, "string");
        return response;
      },
    }),
  } as unknown as SupabaseClient;
}

Deno.test("checkoutBatch returns items on RPC success", async () => {
  const mockData = [
    {
      id: "d-1",
      profile_id: "p-1",
      channel: "email",
      template_key: "welcome_template",
      template_variables: {},
      correlation_id: "corr-1",
      status: "PROCESSING",
      locked_until: "2026-01-01T00:00:00Z",
      locked_by: "worker-1",
      recipient_email: "a@b.com",
      deliveries: [],
    },
  ];
  const supabase = mockSupabaseCheckout({ data: mockData, error: null });
  const result = await checkoutBatch(supabase, "worker-test-1");

  assertEquals(result.error, null);
  assertEquals(result.items.length, 1);
  assertEquals(result.items[0].channel, "email");
});

Deno.test("checkoutBatch returns error on RPC failure", async () => {
  const supabase = mockSupabaseCheckout({
    data: null,
    error: { message: "permission denied for schema message_dispatcher" },
  });
  const result = await checkoutBatch(supabase, "worker-err");

  assertEquals(result.items.length, 0);
  assertEquals(result.error instanceof Error, true);
  assertEquals(result.error?.message, "permission denied for schema message_dispatcher");
});

Deno.test("checkoutBatch returns empty items when RPC returns empty array", async () => {
  const supabase = mockSupabaseCheckout({ data: [], error: null });
  const result = await checkoutBatch(supabase, "worker-empty");

  assertEquals(result.error, null);
  assertEquals(result.items.length, 0);
});

Deno.test("checkoutBatch passes clamped limit to RPC", async () => {
  let capturedLimit = 0;
  const supabase = {
    schema: () => ({
      rpc: async (_name: string, args: { p_limit: number }) => {
        capturedLimit = args.p_limit;
        return { data: [], error: null };
      },
    }),
  } as unknown as SupabaseClient;

  await checkoutBatch(supabase, "worker-lim", 999);
  assertEquals(capturedLimit, 50);
});

Deno.test("parseCheckoutBatch returns empty array for null input", () => {
  assertEquals(parseCheckoutBatch(null), []);
  assertEquals(parseCheckoutBatch(undefined), []);
});

Deno.test("parseCheckoutBatch returns empty array for non-array input", () => {
  assertEquals(parseCheckoutBatch("string"), []);
  assertEquals(parseCheckoutBatch({}), []);
  assertEquals(parseCheckoutBatch(42), []);
});

Deno.test("clampCheckoutLimit handles NaN", () => {
  assertEquals(clampCheckoutLimit(NaN), 25);
});

Deno.test("clampCheckoutLimit floors fractional values", () => {
  assertEquals(clampCheckoutLimit(7.9), 7);
  assertEquals(clampCheckoutLimit(25.5), 25);
});
