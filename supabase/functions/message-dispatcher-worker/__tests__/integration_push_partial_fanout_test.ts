import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  processDispatchItem,
  type ProcessDispatchDeps,
} from "../processDispatch.ts";
import type { CheckoutDispatchDto } from "../types.ts";
import type { ReportDeliveryOutcomeInput } from "../report.ts";

const pushItem: CheckoutDispatchDto = {
  id: "dispatch-partial-fanout",
  profile_id: "550e8400-e29b-41d4-a716-446655440001",
  channel: "push",
  template_key: "engagement_push",
  template_variables: {
    name: "Test",
    headline: "Hi",
    body: "Body",
  },
  correlation_id: "corr-partial-fanout",
  status: "PROCESSING",
  locked_until: "2026-01-01T00:00:00Z",
  locked_by: "worker-partial",
  recipient_email: null,
  deliveries: [
    {
      delivery_id: "del-ok-1",
      device_id: "device-ok-1",
      fcm_token_snapshot: "token-ok-1",
    },
    {
      delivery_id: "del-ok-2",
      device_id: "device-ok-2",
      fcm_token_snapshot: "token-ok-2",
    },
    {
      delivery_id: "del-bad",
      device_id: "device-bad",
      fcm_token_snapshot: "stale-token",
    },
  ],
};

Deno.test("push fan-out: 2 ok + 1 bad token reports parent DELIVERED (task 117)", async () => {
  let reportInput: ReportDeliveryOutcomeInput | undefined;

  const deps: ProcessDispatchDeps = {
    fetchEmailTemplate: async () => {
      throw new Error("unexpected email");
    },
    fetchPushTemplate: async () => ({
      channel: "push" as const,
      template_key: "engagement_push",
      active: true,
      subject_template: "{{headline}}",
      body_template: "{{name}} — {{body}}",
      variable_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          headline: { type: "string" },
          body: { type: "string" },
        },
        required: ["name", "headline", "body"],
      },
    }),
    renderEmailFromTemplate: () => {
      throw new Error("unexpected email");
    },
    validateAndRenderPush: (template) => ({
      title: template.subject_template ?? "",
      body: template.body_template,
    }),
    sendResendEmail: async () => {
      throw new Error("unexpected email");
    },
    sendFcmPush: async (input) => {
      if (input.fcmTokenSnapshot === "stale-token") {
        return {
          ok: false,
          httpStatus: 404,
          errorCode: "NOT_FOUND",
          errorMessage: "Requested entity was not found",
        };
      }
      return {
        ok: true,
        vendorMessageId: `fcm-${input.deliveryId}`,
        httpStatus: 200,
      };
    },
    reportDeliveryOutcome: async (_supabase, input) => {
      reportInput = input;
      return { applied: true, status: "DELIVERED" };
    },
  };

  const counts = await processDispatchItem(
    {} as SupabaseClient,
    pushItem,
    "worker-partial",
    deps,
  );

  assertEquals(counts.sendSucceeded, 1);
  assertEquals(reportInput?.success, true);
  assertEquals(reportInput?.channel, "push");
  assertEquals(reportInput?.deliveries?.length, 3);

  const sent = reportInput?.deliveries?.filter((d) => d.outcome === "sent") ?? [];
  const terminal = reportInput?.deliveries?.filter(
    (d) => d.outcome === "failed_terminal",
  ) ?? [];

  assertEquals(sent.length, 2);
  assertEquals(terminal.length, 1);
  assertEquals(terminal[0]?.device_id, "device-bad");
  assertEquals(terminal[0]?.vendor_error_code, "invalid_token");
});
