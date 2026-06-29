import { assertEquals } from "std/testing/asserts";
import type { NotificationIngestInput } from "../../manual-charge-payment/enqueueNotifications.ts";
import { enqueueReconcileNotifications } from "../enqueueNotifications.ts";
import type { ReconcileSchedule } from "../types.ts";

const schedule: ReconcileSchedule = {
  id: "schedule-1",
  contracted_service_id: "service-1",
  service_request_id: "sr-1",
  client_id: "client-1",
  provider_id: "provider-1",
  state: "IN_ANALYSIS",
  installment_number: 1,
  base_amount: 300,
  payment_token_id: "token-1",
  netcred_company_id: "1048",
  automatic_attempt_count: 1,
  manual_attempt_count: 0,
  max_attempts: 3,
  reconciliation_failure_count: 0,
};

Deno.test("enqueueReconcileNotifications uses deep_link_path for PAID", async () => {
  const ingested: NotificationIngestInput[] = [];

  await enqueueReconcileNotifications(
    async (input) => {
      ingested.push(input);
    },
    schedule,
    {
      applied: true,
      to_state: "PAID",
      charge_amount: "310.39",
    },
  );

  assertEquals(ingested.length, 3);
  for (const input of ingested) {
    assertEquals(input.templateVariables.deep_link_path, "/dashboard/services/sr-1");
    assertEquals("deepLink" in input.templateVariables, false);
  }
});

Deno.test("enqueueReconcileNotifications uses deep_link_path for FAILED_PERMANENT", async () => {
  const ingested: NotificationIngestInput[] = [];

  await enqueueReconcileNotifications(
    async (input) => {
      ingested.push(input);
    },
    schedule,
    {
      applied: true,
      to_state: "FAILED_PERMANENT",
    },
  );

  assertEquals(ingested.length, 3);
  for (const input of ingested) {
    assertEquals(input.templateVariables.deep_link_path, "/dashboard/services/sr-1");
    assertEquals("deepLink" in input.templateVariables, false);
  }
});
