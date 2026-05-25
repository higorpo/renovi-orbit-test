import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileResendVendorEvent } from "../reconcile.ts";

function mockSupabaseDeliveredReconcile(): SupabaseClient {
  return {
    schema: () => ({
      rpc: async (
        name: string,
        args: {
          p_vendor_event_id: string;
          p_vendor: string;
          p_event_type: string;
          p_vendor_message_id: string | null;
          p_payload: Record<string, unknown>;
        },
      ) => {
        assertEquals(name, "message_dispatcher_reconcile_vendor_event");
        assertEquals(args.p_vendor, "resend");
        assertEquals(args.p_event_type, "email.delivered");
        assertEquals(args.p_vendor_message_id, "re_delivered_e2e");
        return {
          data: {
            applied: true,
            dispatch_updated: true,
            status: "DELIVERED",
            dispatch_id: "550e8400-e29b-41d4-a716-446655440099",
          },
          error: null,
        };
      },
    }),
  } as unknown as SupabaseClient;
}

Deno.test("webhook email.delivered reconcile returns DELIVERED (task 118)", async () => {
  const supabase = mockSupabaseDeliveredReconcile();
  const result = await reconcileResendVendorEvent(supabase, {
    vendorEventId: "svix_evt_delivered_e2e",
    event: {
      type: "email.delivered",
      data: { email_id: "re_delivered_e2e" },
    },
    rawPayload: { type: "email.delivered" },
  });

  assertEquals(result.ok, true);
  assertEquals(result.data?.status, "DELIVERED");
  assertEquals(result.data?.dispatch_updated, true);
  assertEquals(result.data?.dispatch_id, "550e8400-e29b-41d4-a716-446655440099");
});
