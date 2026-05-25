import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractResendVendorMessageId,
  reconcileResendVendorEvent,
} from "../reconcile.ts";

function mockSupabaseRpcError(errorMsg: string): SupabaseClient {
  return {
    schema: () => ({
      rpc: async () => ({
        data: null,
        error: { message: errorMsg, code: "P0001" },
      }),
    }),
  } as unknown as SupabaseClient;
}

Deno.test("reconcileResendVendorEvent returns ok:false when RPC errors", async () => {
  const supabase = mockSupabaseRpcError("dispatch_not_found");
  const result = await reconcileResendVendorEvent(supabase, {
    vendorEventId: "svix_evt_err",
    event: { type: "email.delivered", data: { email_id: "re_err" } },
    rawPayload: { type: "email.delivered" },
  });

  assertEquals(result.ok, false);
  assertEquals(result.error, "dispatch_not_found");
  assertEquals(result.data, undefined);
});

Deno.test("reconcileResendVendorEvent returns ok:false on RPC constraint violation", async () => {
  const supabase = mockSupabaseRpcError("unique_violation: vendor_event_id already processed");
  const result = await reconcileResendVendorEvent(supabase, {
    vendorEventId: "svix_evt_dup_constraint",
    event: { type: "email.bounced", data: { email_id: "re_bounced" } },
    rawPayload: { type: "email.bounced" },
  });

  assertEquals(result.ok, false);
  assertEquals(result.error, "unique_violation: vendor_event_id already processed");
});

Deno.test("extractResendVendorMessageId falls back to data.id when email_id absent", () => {
  const result = extractResendVendorMessageId({
    type: "email.bounced",
    data: { id: "fallback-id-value" },
  });
  assertEquals(result, "fallback-id-value");
});

Deno.test("extractResendVendorMessageId trims whitespace from candidate", () => {
  const result = extractResendVendorMessageId({
    type: "email.delivered",
    data: { email_id: "  re_trimmed  " },
  });
  assertEquals(result, "re_trimmed");
});

Deno.test("extractResendVendorMessageId returns null for empty string", () => {
  const result = extractResendVendorMessageId({
    type: "email.delivered",
    data: { email_id: "   " },
  });
  assertEquals(result, null);
});

Deno.test("extractResendVendorMessageId returns null for non-string value", () => {
  const result = extractResendVendorMessageId({
    type: "email.delivered",
    data: { email_id: 12345 as unknown as string },
  });
  assertEquals(result, null);
});
