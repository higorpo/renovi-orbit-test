import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  processDispatchItem,
  type ProcessDispatchDeps,
} from "../processDispatch.ts";
import type { CheckoutDispatchDto } from "../types.ts";
import type { ReportDeliveryOutcomeInput } from "../report.ts";

const pushItem: CheckoutDispatchDto = {
  id: "dispatch-fcm-bad",
  profile_id: "550e8400-e29b-41d4-a716-446655440001",
  channel: "push",
  template_key: "engagement_push",
  template_variables: {
    name: "Test",
    headline: "Hi",
    body: "Body",
  },
  correlation_id: "corr-fcm-bad",
  status: "PROCESSING",
  locked_until: "2026-01-01T00:00:00Z",
  locked_by: "worker-fcm",
  recipient_email: null,
  deliveries: [{
    delivery_id: "del-1",
    device_id: "device-fcm-bad",
    fcm_token_snapshot: "stale-token",
  }],
};

Deno.test("processDispatch maps FCM 404 to terminal invalid_token report", async () => {
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
    sendFcmPush: async () => ({
      ok: false,
      httpStatus: 404,
      errorCode: "NOT_FOUND",
      errorMessage: "Requested entity was not found",
    }),
    reportDeliveryOutcome: async (_supabase, input) => {
      reportInput = input;
      return { applied: true, status: "FAILED_TERMINAL" };
    },
  };

  const counts = await processDispatchItem(
    {} as SupabaseClient,
    pushItem,
    "worker-fcm",
    deps,
  );

  assertEquals(counts.sendFailed, 1);
  assertEquals(reportInput?.success, false);
  assertEquals(reportInput?.retryable, false);
  assertEquals(reportInput?.errorCode, "invalid_token");
  assertEquals(reportInput?.deliveries?.[0]?.outcome, "failed_terminal");
  assertEquals(reportInput?.deliveries?.[0]?.vendor_error_code, "invalid_token");
  assertEquals(reportInput?.deliveries?.[0]?.device_id, "device-fcm-bad");
});
