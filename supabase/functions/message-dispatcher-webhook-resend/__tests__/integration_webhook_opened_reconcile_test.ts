import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileResendVendorEvent } from "../reconcile.ts";

function mockSupabaseOpenedReconcile(): SupabaseClient {
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
        assertEquals(args.p_event_type, "email.opened");
        assertEquals(args.p_vendor_message_id, "re_opened_e2e");
        return {
          data: {
            applied: true,
            dispatch_updated: false,
            engagement_recorded: true,
            dispatch_id: "550e8400-e29b-41d4-a716-446655440088",
          },
          error: null,
        };
      },
    }),
  } as unknown as SupabaseClient;
}

Deno.test("webhook email.opened reconcile records engagement without FSM change", async () => {
  const supabase = mockSupabaseOpenedReconcile();
  const result = await reconcileResendVendorEvent(supabase, {
    vendorEventId: "svix_evt_opened_e2e",
    event: {
      type: "email.opened",
      data: { email_id: "re_opened_e2e" },
    },
    rawPayload: { type: "email.opened" },
  });

  assertEquals(result.ok, true);
  assertEquals(result.data?.dispatch_updated, false);
  assertEquals(result.data?.engagement_recorded, true);
  assertEquals(result.data?.dispatch_id, "550e8400-e29b-41d4-a716-446655440088");
});
