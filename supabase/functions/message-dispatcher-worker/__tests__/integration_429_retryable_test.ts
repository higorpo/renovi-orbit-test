import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  processDispatchItem,
  type ProcessDispatchDeps,
} from "../processDispatch.ts";
import type { CheckoutDispatchDto } from "../types.ts";
import type { ReportDeliveryOutcomeInput } from "../report.ts";

const emailItem: CheckoutDispatchDto = {
  id: "dispatch-429",
  profile_id: "550e8400-e29b-41d4-a716-446655440001",
  channel: "email",
  template_key: "welcome_template",
  template_variables: { name: "Test" },
  correlation_id: "corr-429",
  status: "PROCESSING",
  locked_until: "2026-01-01T00:00:00Z",
  locked_by: "worker-429",
  recipient_email: "user@example.com",
  deliveries: [],
};

Deno.test("processDispatch maps mock Resend 429 to retryable report", async () => {
  let reportInput: ReportDeliveryOutcomeInput | undefined;

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
      ok: false,
      httpStatus: 429,
      errorCode: "rate_limit_exceeded",
      errorMessage: "Too many requests",
    }),
    sendFcmPush: async () => {
      throw new Error("unexpected push");
    },
    reportDeliveryOutcome: async (_supabase, input) => {
      reportInput = input;
      return { applied: true, status: "FAILED_RETRYABLE" };
    },
  };

  const counts = await processDispatchItem(
    {} as SupabaseClient,
    emailItem,
    "worker-429",
    deps,
  );

  assertEquals(counts.sendFailed, 1);
  assertEquals(reportInput?.httpStatus, 429);
  assertEquals(reportInput?.retryable, true);
  assertEquals(reportInput?.errorCode, "rate_limit_exceeded");
});
