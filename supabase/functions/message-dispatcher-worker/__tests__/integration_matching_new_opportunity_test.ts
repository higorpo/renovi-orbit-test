import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  processDispatchItem,
  type ProcessDispatchDeps,
} from "../processDispatch.ts";
import { renderEmailFromTemplate } from "../renderEmail.ts";
import { validateAndRenderPush } from "../renderPush.ts";
import type { CheckoutDispatchDto } from "../types.ts";
import {
  MATCHING_NEW_OPPORTUNITY_EMAIL_TEMPLATE,
  MATCHING_NEW_OPPORTUNITY_PUSH_TEMPLATE,
  MATCHING_NEW_OPPORTUNITY_TEMPLATE_VARIABLES,
} from "./fixtures/matchingNewOpportunityTemplate.ts";

const templateVariables = { ...MATCHING_NEW_OPPORTUNITY_TEMPLATE_VARIABLES };

const pushItem: CheckoutDispatchDto = {
  id: "dispatch-matching-push",
  profile_id: "5d09e025-20a2-4842-aeef-324d42a431e1",
  channel: "push",
  template_key: "matching.new_opportunity",
  template_variables: templateVariables,
  correlation_id: "corr-matching-push",
  status: "PROCESSING",
  locked_until: "2026-01-01T00:00:00Z",
  locked_by: "worker-matching",
  recipient_email: null,
  deliveries: [
    {
      delivery_id: "del-matching-push",
      device_id: "device-matching",
      fcm_token_snapshot: "token-matching",
    },
  ],
};

const emailItem: CheckoutDispatchDto = {
  id: "dispatch-matching-email",
  profile_id: "5d09e025-20a2-4842-aeef-324d42a431e1",
  channel: "email",
  template_key: "matching.new_opportunity",
  template_variables: templateVariables,
  correlation_id: "corr-matching-email",
  status: "PROCESSING",
  locked_until: "2026-01-01T00:00:00Z",
  locked_by: "worker-matching",
  recipient_email: "provider@example.com",
  deliveries: [],
};

function createMatchingDeps(): ProcessDispatchDeps {
  return {
    fetchEmailTemplate: async () => ({
      channel: "email" as const,
      template_key: "matching.new_opportunity",
      active: true,
      ...MATCHING_NEW_OPPORTUNITY_EMAIL_TEMPLATE,
      variable_schema: MATCHING_NEW_OPPORTUNITY_PUSH_TEMPLATE.variable_schema,
    }),
    fetchPushTemplate: async () => ({
      channel: "push" as const,
      template_key: "matching.new_opportunity",
      active: true,
      ...MATCHING_NEW_OPPORTUNITY_PUSH_TEMPLATE,
    }),
    renderEmailFromTemplate,
    validateAndRenderPush,
    sendResendEmail: async () => ({
      ok: true,
      vendorMessageId: "re_matching_mock",
      httpStatus: 200,
    }),
    sendFcmPush: async () => ({
      ok: true,
      vendorMessageId: "fcm_matching_mock",
      httpStatus: 200,
    }),
    reportDeliveryOutcome: async () => ({ applied: true, status: "DELIVERED" }),
  };
}

Deno.test("matching.new_opportunity push pipeline reports DELIVERED via generic worker", async () => {
  let fcmBody: string | undefined;
  const deps = createMatchingDeps();
  deps.sendFcmPush = async (input) => {
    fcmBody = input.body;
    return {
      ok: true,
      vendorMessageId: "fcm_matching_mock",
      httpStatus: 200,
    };
  };

  const counts = await processDispatchItem(
    {} as SupabaseClient,
    pushItem,
    "worker-matching",
    deps,
  );

  assertEquals(counts.sendSucceeded, 1);
  assertEquals(fcmBody, "Fix kitchen sink — Pinheiros");
});

Deno.test("matching.new_opportunity email pipeline reports DELIVERED via generic worker", async () => {
  let emailSubject: string | undefined;
  const deps = createMatchingDeps();
  deps.sendResendEmail = async (input) => {
    emailSubject = input.subject;
    return {
      ok: true,
      vendorMessageId: "re_matching_mock",
      httpStatus: 200,
    };
  };

  const counts = await processDispatchItem(
    {} as SupabaseClient,
    emailItem,
    "worker-matching",
    deps,
  );

  assertEquals(counts.sendSucceeded, 1);
  assertEquals(emailSubject, "Nova oportunidade: Fix kitchen sink");
});
