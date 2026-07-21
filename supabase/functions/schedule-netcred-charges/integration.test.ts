import { assertEquals, assertExists } from "std/testing/asserts";
import {
  handleScheduleNetcredChargesRequest,
  type ScheduleNetcredChargesDeps,
} from "./handleRequest.ts";
import { ChargeStateHarness } from "./integrationStateHarness.ts";
import { MockNetCredServer } from "./mockNetcredServer.ts";
import { processSchedule, type ProcessScheduleDeps } from "./processSchedule.ts";

function buildProcessDeps(
  harness: ChargeStateHarness,
  netcred: MockNetCredServer,
  scheduleId: string,
): ProcessScheduleDeps {
  return {
    calculateChargeAmount: async () => "1024.29",
    loadPaymentToken: async () => ({
      gateway_payment_profile_id: "403137",
      gateway_card_token: "tok",
      netcred_company_id: "1014",
    }),
    loadProviderAccount: async () => ({
      netcred_company_id: "1048",
      netcred_bank_account_id: "2053",
      onboarding_status: "ACTIVE",
    }),
    getTransaction: netcred.getTransaction,
    createCharge: netcred.createCharge,
    commitResult: async (input) => harness.commitResult({
      scheduleId: input.scheduleId,
      outcome: input.outcome,
      chargeAmount: input.chargeAmount,
      undoAttemptIncrement: input.undoAttemptIncrement,
      failureCode: input.failureCode,
    }),
    loadHistoricalFailureCodes: async () => [],
    emitFailedPermanentWarning: () => {},
    ingestNotification: async (input) => {
      harness.notifications.push(`${input.templateKey}:${input.profileId}`);
    },
    maxAttempts: 3,
    platformCompanyId: "1014",
    isProduction: false,
  };
}

async function runCronPass(
  harness: ChargeStateHarness,
  netcred: MockNetCredServer,
): Promise<Response> {
  const previousKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const previousEnvironment = Deno.env.get("ENVIRONMENT");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");

  try {
    const deps: ScheduleNetcredChargesDeps = {
      dequeueSchedules: async () => harness.dequeue(),
      processSchedule: async (schedule) =>
        processSchedule(buildProcessDeps(harness, netcred, schedule.id), schedule),
      captureException: () => {},
      maxAttempts: 3,
    };

    return handleScheduleNetcredChargesRequest(
      new Request("https://example.com/schedule-netcred-charges", {
        method: "POST",
        headers: { Authorization: "Bearer test-service-role" },
      }),
      deps,
    );
  } finally {
    if (previousKey === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousKey);
    }
    if (previousEnvironment === undefined) {
      Deno.env.delete("ENVIRONMENT");
    } else {
      Deno.env.set("ENVIRONMENT", previousEnvironment);
    }
  }
}

Deno.test("integration: SCHEDULED → PROCESSING → PAID via cron commit", async () => {
  const harness = new ChargeStateHarness();
  const netcred = new MockNetCredServer();
  netcred.setScenario("paid");

  const seeded = harness.seedSchedule();
  const response = await runCronPass(harness, netcred);
  const summary = await response.json();

  assertEquals(summary.paid, 1);
  assertEquals(harness.getSchedule(seeded.id).state, "PAID");
  assertEquals(harness.attempts.length, 1);
  assertEquals(harness.events.some((e) => e.event_type === "ChargeSucceeded"), true);
  assertEquals(
    harness.auditLog.some((e) => e.event_type === "CHARGE_PAID"),
    true,
  );
});

Deno.test("integration: SCHEDULED → PROCESSING → IN_ANALYSIS → PAID via webhook", async () => {
  const harness = new ChargeStateHarness();
  const netcred = new MockNetCredServer();
  netcred.setScenario("in_analysis");

  const seeded = harness.seedSchedule();
  const firstPass = await runCronPass(harness, netcred);
  assertEquals((await firstPass.json()).in_analysis, 1);
  assertEquals(harness.getSchedule(seeded.id).state, "IN_ANALYSIS");

  netcred.captureTransaction(seeded.contracted_service_id);
  harness.applyWebhookCapture(seeded.id);

  assertEquals(harness.getSchedule(seeded.id).state, "PAID");
  assertEquals(harness.events.filter((e) => e.event_type === "ChargeSucceeded").length, 1);
});

Deno.test("integration: retryable FAILED → retry PROCESSING → FAILED_PERMANENT at max attempts", async () => {
  const harness = new ChargeStateHarness();
  const netcred = new MockNetCredServer();
  netcred.setScenario("retryable");

  const seeded = harness.seedSchedule();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    harness.getSchedule(seeded.id).next_retry_at = new Date(Date.now() - 1000);
    const response = await runCronPass(harness, netcred);
    const summary = await response.json();

    if (attempt < 3) {
      assertEquals(summary.failed, 1);
      assertEquals(harness.getSchedule(seeded.id).state, "FAILED");
    } else {
      assertEquals(summary.failed_permanent, 1);
      assertEquals(harness.getSchedule(seeded.id).state, "FAILED_PERMANENT");
    }
  }

  assertEquals(harness.attempts.length, 3);
});

Deno.test("integration: terminal error → FAILED_PERMANENT without consuming retry budget", async () => {
  const harness = new ChargeStateHarness();
  const netcred = new MockNetCredServer();
  netcred.setScenario("terminal");

  const seeded = harness.seedSchedule();
  const response = await runCronPass(harness, netcred);
  const summary = await response.json();

  assertEquals(summary.failed_permanent, 1);
  const schedule = harness.getSchedule(seeded.id);
  assertEquals(schedule.state, "FAILED_PERMANENT");
  assertEquals(schedule.automatic_attempt_count, 0);
});

Deno.test("integration: emergency scheduling sets charge_scheduled_at to now", () => {
  const harness = new ChargeStateHarness();
  const seeded = harness.seedSchedule({
    charge_scheduled_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  harness.applyEmergencyScheduling(seeded.id);

  const schedule = harness.getSchedule(seeded.id);
  assertEquals(schedule.charge_scheduled_at.getTime() <= Date.now() + 1000, true);
});

Deno.test("integration: auto_cancel_services at T-12h after FAILED_PERMANENT", () => {
  const harness = new ChargeStateHarness();
  const seeded = harness.seedSchedule({
    state: "FAILED_PERMANENT",
    service_scheduled_at: new Date(Date.now() + 6 * 60 * 60 * 1000),
  });

  const cancelled = harness.runAutoCancel();

  assertEquals(cancelled, [seeded.contracted_service_id]);
  assertEquals(harness.getSchedule(seeded.id).state, "CANCELLED");
  assertEquals(
    harness.auditLog.some((e) => e.event_type === "SERVICE_AUTO_CANCELLED"),
    true,
  );
});

Deno.test("integration: mock NetCred HTTP server responds to chargeCreate", async () => {
  const netcred = new MockNetCredServer();
  netcred.setScenario("paid");

  const port = await netcred.listen();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operationName: "chargeCreate",
        variables: {
          input: { referenceCode: "service-http-test" },
        },
      }),
    });

    assertEquals(response.status, 200);
    const body = await response.json();
    assertExists(body.data?.chargeCreate?.charge?.id);
    assertEquals(netcred.getCreateChargeCallCount(), 1);
  } finally {
    netcred.close();
  }
});

Deno.test("integration: audit log and payment_events emitted for each transition", async () => {
  const harness = new ChargeStateHarness();
  const netcred = new MockNetCredServer();
  netcred.setScenario("paid");

  const seeded = harness.seedSchedule();
  await runCronPass(harness, netcred);

  assertEquals(harness.auditLog.length >= 2, true);
  assertEquals(harness.events.length >= 1, true);
  assertEquals(harness.getSchedule(seeded.id).state, "PAID");
});
