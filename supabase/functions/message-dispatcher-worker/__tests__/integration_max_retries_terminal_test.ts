import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  processDispatchItem,
  type ProcessDispatchDeps,
} from "../processDispatch.ts";
import type { CheckoutDispatchDto } from "../types.ts";

const emailItem: CheckoutDispatchDto = {
  id: "dispatch-max-retries",
  profile_id: "550e8400-e29b-41d4-a716-446655440001",
  channel: "email",
  template_key: "welcome_template",
  template_variables: { name: "Test" },
  correlation_id: "corr-max-retries",
  status: "PROCESSING",
  locked_until: "2026-01-01T00:00:00Z",
  locked_by: "worker-max",
  recipient_email: "user@example.com",
  deliveries: [],
};

Deno.test("processDispatch marks 503 failure retryable for RPC max_retries handling", async () => {
  let retryable: boolean | undefined;

  const deps: ProcessDispatchDeps = {
    fetchEmailTemplate: async () => ({
      channel: "email" as const,
      template_key: "welcome_template",
      active: true,
      subject_template: "Hi",
      body_template: "Body",
      json_schema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    }),
    fetchPushTemplate: async () => {
      throw new Error("unexpected push");
    },
    renderEmailFromTemplate: (t) => ({
      subject: t.subject_template ?? "",
      html: t.body_template,
    }),
    validateAndRenderPush: () => {
      throw new Error("unexpected push");
    },
    sendResendEmail: async () => ({
      ok: false,
      httpStatus: 503,
      errorCode: "provider_unavailable",
      errorMessage: "upstream",
    }),
    sendFcmPush: async () => {
      throw new Error("unexpected push");
    },
    reportDeliveryOutcome: async (_supabase, input) => {
      retryable = input.retryable;
      return { applied: true, status: "FAILED_RETRYABLE" };
    },
  };

  const counts = await processDispatchItem(
    {} as SupabaseClient,
    emailItem,
    "worker-max",
    deps,
  );

  assertEquals(counts.sendFailed, 1);
  assertEquals(retryable, true);
});
