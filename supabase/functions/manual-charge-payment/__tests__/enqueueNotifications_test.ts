import { assertEquals } from "std/testing/asserts";
import { enqueueManualChargeNotifications } from "../enqueueNotifications.ts";
import type { ManualChargeSchedule } from "../types.ts";

const schedule: ManualChargeSchedule = {
  id: "schedule-1",
  contracted_service_id: "service-1",
  service_request_id: "sr-1",
  client_id: "client-1",
  provider_id: "provider-1",
  gateway_slug: "netcred",
  client_card_token_id: "token-1",
  provider_payout: 850,
  installment_number: 1,
  base_amount: 1000,
  state: "PROCESSING",
  manual_attempt_count: 1,
  automatic_attempt_count: 3,
  max_attempts: 3,
  clearsale_session_id: null,
  client_ip_address: "189.0.0.1",
};

Deno.test("enqueueManualChargeNotifications maps PAID to CHARGE_SUCCEEDED", async () => {
  let notificationEvent: string | undefined;
  let metadata: Record<string, unknown> | undefined;

  await enqueueManualChargeNotifications(
    async (_scheduleId, event, nextMetadata) => {
      notificationEvent = event;
      metadata = nextMetadata;
    },
    schedule,
    "PAID",
    "1024.29",
  );

  assertEquals(notificationEvent, "CHARGE_SUCCEEDED");
  assertEquals(metadata?.deep_link_path, "/dashboard/services/sr-1");
  assertEquals(metadata?.initiator, "manual");
});

Deno.test("enqueueManualChargeNotifications maps FAILED_PERMANENT to CHARGE_FAILED_PERMANENT", async () => {
  let notificationEvent: string | undefined;

  await enqueueManualChargeNotifications(
    async (_scheduleId, event) => {
      notificationEvent = event;
    },
    schedule,
    "FAILED_PERMANENT",
    "1024.29",
  );

  assertEquals(notificationEvent, "CHARGE_FAILED_PERMANENT");
});

Deno.test("enqueueManualChargeNotifications maps IN_ANALYSIS to CHARGE_IN_ANALYSIS", async () => {
  let notificationEvent: string | undefined;

  await enqueueManualChargeNotifications(
    async (_scheduleId, event) => {
      notificationEvent = event;
    },
    schedule,
    "IN_ANALYSIS",
    "1024.29",
  );

  assertEquals(notificationEvent, "CHARGE_IN_ANALYSIS");
});
