import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  processDispatchItem,
  type ProcessDispatchDeps,
} from "../processDispatch.ts";
import type { CheckoutDispatchDto } from "../types.ts";

const emailItem: CheckoutDispatchDto = {
  id: "dispatch-e2e-email",
  profile_id: "550e8400-e29b-41d4-a716-446655440001",
  channel: "email",
  template_key: "welcome_template",
  template_variables: { name: "E2E" },
  correlation_id: "corr-e2e-email",
  status: "PROCESSING",
  locked_until: "2026-01-01T00:00:00Z",
  locked_by: "worker-e2e",
  recipient_email: "e2e@example.com",
  deliveries: [],
};

Deno.test("email pipeline mock Resend success reports DELIVERED (task 116)", async () => {
  let reportedStatus: string | undefined;

  const deps: ProcessDispatchDeps = {
    fetchEmailTemplate: async () => ({
      channel: "email" as const,
      template_key: "welcome_template",
      active: true,
      subject_template: "Hi {{name}}",
      body_template: "<p>{{name}}</p>",
      json_schema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    }),
    fetchPushTemplate: async () => {
      throw new Error("unexpected push");
    },
    renderEmailFromTemplate: (template) => ({
      subject: template.subject_template ?? "",
      html: template.body_template,
    }),
    validateAndRenderPush: () => {
      throw new Error("unexpected push");
    },
    sendResendEmail: async () => ({
      ok: true,
      vendorMessageId: "re_e2e_mock",
      httpStatus: 200,
    }),
    sendFcmPush: async () => {
      throw new Error("unexpected push");
    },
    reportDeliveryOutcome: async (_supabase, input) => {
      reportedStatus = input.success ? "DELIVERED" : "FAILED";
      return { applied: true, status: reportedStatus };
    },
  };

  const outcome = await processDispatchItem(
    {} as SupabaseClient,
    emailItem,
    "worker-e2e",
    deps,
  );

  assertEquals(outcome.sendSucceeded >= 1, true);
  assertEquals(reportedStatus, "DELIVERED");
});
