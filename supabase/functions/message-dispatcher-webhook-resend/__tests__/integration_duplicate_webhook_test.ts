import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileResendVendorEvent } from "../reconcile.ts";

function mockSupabaseDuplicateReplay(): SupabaseClient {
  let calls = 0;
  return {
    schema: () => ({
      rpc: async () => {
        calls += 1;
        if (calls === 1) {
          return {
            data: {
              status: "DELIVERED",
              duplicate: false,
              dispatch_updated: true,
            },
            error: null,
          };
        }
        return {
          data: {
            status: "DELIVERED",
            duplicate: true,
            dispatch_updated: false,
          },
          error: null,
        };
      },
    }),
  } as unknown as SupabaseClient;
}

Deno.test("webhook reconcile path is idempotent on duplicate svix event id", async () => {
  const supabase = mockSupabaseDuplicateReplay();
  const input = {
    vendorEventId: "svix_evt_webhook_dup_int",
    event: { type: "email.delivered" as const, data: { email_id: "re_webhook_dup_int" } },
    rawPayload: { type: "email.delivered" },
  };

  const first = await reconcileResendVendorEvent(supabase, input);
  const second = await reconcileResendVendorEvent(supabase, input);

  assertEquals(first.ok, true);
  assertEquals(first.data?.duplicate, false);
  assertEquals(first.data?.dispatch_updated, true);

  assertEquals(second.ok, true);
  assertEquals(second.data?.duplicate, true);
  assertEquals(second.data?.dispatch_updated, false);
});
