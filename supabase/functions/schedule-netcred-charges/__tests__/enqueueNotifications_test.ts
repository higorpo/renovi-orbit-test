import { assertEquals } from "std/testing/asserts";
import { enqueueCronChargeNotifications } from "../enqueueNotifications.ts";
import type { CronChargeSchedule } from "../types.ts";

const schedule: CronChargeSchedule = {
  id: "schedule-1",
  contracted_service_id: "service-1",
  service_request_id: "sr-1",
  client_id: "client-1",
  provider_id: "provider-1",
  gateway_slug: "netcred",
  client_card_token_id: "token-1",
  installment_number: 1,
  base_amount: 1000,
  provider_payout: 850,
  netcred_company_id: "1048",
  automatic_attempt_count: 1,
  max_attempts: 3,
  clearsale_session_id: "session-1",
  client_ip_address: "189.0.0.1",
};

Deno.test("enqueueCronChargeNotifications uses deep_link_path metadata", async () => {
  let metadata: Record<string, unknown> | undefined;

  await enqueueCronChargeNotifications(
    async (_scheduleId, _notificationEvent, nextMetadata) => {
      metadata = nextMetadata;
    },
    schedule,
    "PAID",
    "1024.29",
  );

  assertEquals(metadata?.deep_link_path, "/dashboard/services/sr-1");
  assertEquals("deepLink" in (metadata ?? {}), false);
});

Deno.test("enqueueCronChargeNotifications maps FAILED outcomes", async () => {
  const events: string[] = [];
  for (const outcome of ["FAILED", "FAILED_PERMANENT", "IN_ANALYSIS"] as const) {
    await enqueueCronChargeNotifications(
      async (_id, event) => {
        events.push(event);
      },
      schedule,
      outcome,
      "10.00",
    );
  }
  assertEquals(events, [
    "CHARGE_FAILED",
    "CHARGE_FAILED_PERMANENT",
    "CHARGE_IN_ANALYSIS",
  ]);
});

Deno.test("enqueueCronChargeNotifications skips unknown outcomes", async () => {
  let called = false;
  await enqueueCronChargeNotifications(
    async () => {
      called = true;
    },
    schedule,
    "UNKNOWN" as never,
    "10.00",
  );
  assertEquals(called, false);
});

Deno.test("enqueueCronChargeNotifications falls back deep link without service_request_id", async () => {
  let metadata: Record<string, unknown> | undefined;
  await enqueueCronChargeNotifications(
    async (_id, _event, next) => {
      metadata = next;
    },
    { ...schedule, service_request_id: null },
    "PAID",
    "10.00",
  );
  assertEquals(metadata?.deep_link_path, "/dashboard/services");
});
