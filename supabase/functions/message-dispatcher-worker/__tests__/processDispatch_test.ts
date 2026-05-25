import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  processCheckoutItemsSequential,
  type ProcessDispatchDeps,
} from "../processDispatch.ts";
import type { CheckoutDispatchDto } from "../types.ts";

function emailItem(id: string): CheckoutDispatchDto {
  return {
    id,
    profile_id: "550e8400-e29b-41d4-a716-446655440001",
    channel: "email",
    template_key: "welcome_template",
    template_variables: {},
    correlation_id: `corr-${id}`,
    status: "PROCESSING",
    locked_until: "2026-01-01T00:00:00Z",
    locked_by: "worker-seq",
    recipient_email: "user@example.com",
    deliveries: [],
  };
}

Deno.test("processCheckoutItemsSequential awaits report before next dispatch", async () => {
  const order: string[] = [];
  let inFlightReports = 0;
  let maxInFlightReports = 0;

  const deps: ProcessDispatchDeps = {
    fetchEmailTemplate: async () => {
      order.push("template");
      return {
        channel: "email" as const,
        template_key: "welcome_template",
        active: true,
        subject_template: "Hi",
        body_template: "Body",
        json_schema: {},
      };
    },
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
    sendResendEmail: async (input) => {
      order.push(`send:${input.correlationId}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true, vendorMessageId: "re_1", httpStatus: 200 };
    },
    sendFcmPush: async () => {
      throw new Error("unexpected push");
    },
    reportDeliveryOutcome: async (_supabase, input) => {
      inFlightReports += 1;
      maxInFlightReports = Math.max(maxInFlightReports, inFlightReports);
      order.push(`report:${input.dispatchId}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlightReports -= 1;
      return { applied: true, status: "DELIVERED" };
    },
  };

  const items = [emailItem("dispatch-a"), emailItem("dispatch-b")];
  const result = await processCheckoutItemsSequential(
    {} as SupabaseClient,
    items,
    "worker-seq",
    deps,
  );

  assertEquals(result.processed, 2);
  assertEquals(result.succeeded, 2);
  assertEquals(maxInFlightReports, 1);
  assertEquals(order, [
    "template",
    "send:corr-dispatch-a",
    "report:dispatch-a",
    "template",
    "send:corr-dispatch-b",
    "report:dispatch-b",
  ]);
});
