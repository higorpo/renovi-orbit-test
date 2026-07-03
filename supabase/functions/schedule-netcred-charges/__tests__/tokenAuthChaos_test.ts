import { assertEquals } from "std/testing/asserts";
import { ProviderAuthError } from "../../_shared/payment/errors.ts";
import {
  handleScheduleNetcredChargesRequest,
  type ScheduleNetcredChargesDeps,
} from "../handleRequest.ts";
import { processSchedule, type ProcessScheduleDeps } from "../processSchedule.ts";
import { ChargeStateHarness } from "../integrationStateHarness.ts";
import type { CronChargeSchedule } from "../types.ts";

const baseSchedule: CronChargeSchedule = {
  id: "schedule-auth",
  contracted_service_id: "service-auth",
  service_request_id: "sr-auth",
  client_id: "client-1",
  provider_id: "provider-1",
  gateway_slug: "netcred",
  client_card_token_id: "token-1",
  provider_payout: 850,
  netcred_company_id: "1048",
  installment_number: 1,
  base_amount: 1000,
  automatic_attempt_count: 1,
  max_attempts: 3,
  clearsale_session_id: "session-1",
  client_ip_address: "189.0.0.1",
};

function createProcessDeps(
  overrides: Partial<ProcessScheduleDeps> = {},
): ProcessScheduleDeps {
  return {
    calculateChargeAmount: async () => "1024.29",
    loadPaymentToken: async () => ({
      gateway_payment_profile_id: "403137",
      gateway_card_token: "tok",
    }),
    loadProviderAccount: async () => ({
      netcred_company_id: "1048",
      netcred_bank_account_id: "2053",
      onboarding_status: "ACTIVE",
    }),
    getTransaction: async () => null,
    createCharge: async () => {
      throw new ProviderAuthError("NETCRED_AUTH_FAILURE");
    },
    commitResult: async () => "schedule-auth",
    loadHistoricalFailureCodes: async () => [],
    emitFailedPermanentWarning: () => {},
    ingestNotification: async () => {},
    maxAttempts: 3,
    ...overrides,
  };
}

Deno.test("tokenAuth failure commits FAILED with attempt increment undone", async () => {
  let committed: {
    outcome: string;
    undoAttemptIncrement: boolean;
    failureCode?: string;
  } | undefined;

  const result = await processSchedule(
    createProcessDeps({
      commitResult: async (input) => {
        committed = {
          outcome: input.outcome,
          undoAttemptIncrement: input.undoAttemptIncrement,
          failureCode: input.failureCode,
        };
        return baseSchedule.id;
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "FAILED");
  assertEquals(committed?.outcome, "FAILED");
  assertEquals(committed?.undoAttemptIncrement, true);
  assertEquals(committed?.failureCode, "NETCRED_AUTH_FAILURE");
});

Deno.test("tokenAuth failure in cron batch counts as failed not isolated error", async () => {
  const previousServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const previousEnvironment = Deno.env.get("ENVIRONMENT");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");

  try {
    const deps: ScheduleNetcredChargesDeps = {
      dequeueSchedules: async () => [baseSchedule],
      processSchedule: async (schedule) =>
        processSchedule(createProcessDeps(), schedule),
      captureException: () => {
        throw new Error("captureException should not run for handled auth failure");
      },
      maxAttempts: 3,
    };

    const response = await handleScheduleNetcredChargesRequest(
      new Request("https://example.com/schedule-netcred-charges", {
        method: "POST",
        headers: { Authorization: "Bearer test-service-role" },
      }),
      deps,
    );
    const summary = await response.json();

    assertEquals(summary.processed, 1);
    assertEquals(summary.failed, 1);
    assertEquals(summary.errors, 0);
  } finally {
    if (previousServiceRoleKey === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousServiceRoleKey);
    }
    if (previousEnvironment === undefined) {
      Deno.env.delete("ENVIRONMENT");
    } else {
      Deno.env.set("ENVIRONMENT", previousEnvironment);
    }
  }
});

Deno.test("integration: tokenAuth failure leaves retry budget intact in state harness", async () => {
  const harness = new ChargeStateHarness();
  const seeded = harness.seedSchedule();
  const [leased] = harness.dequeue();

  await processSchedule(
    createProcessDeps({
      commitResult: async (input) => harness.commitResult({
        scheduleId: input.scheduleId,
        outcome: input.outcome,
        chargeAmount: input.chargeAmount,
        undoAttemptIncrement: input.undoAttemptIncrement,
        failureCode: input.failureCode,
      }),
    }),
    leased,
  );

  const schedule = harness.getSchedule(seeded.id);
  assertEquals(schedule.state, "FAILED");
  assertEquals(schedule.automatic_attempt_count, 0);
  assertEquals(harness.attempts.length, 1);
});
