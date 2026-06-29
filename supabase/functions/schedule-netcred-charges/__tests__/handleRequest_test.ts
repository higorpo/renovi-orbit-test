import { assertEquals } from "std/testing/asserts";
import type { CreateChargeResult } from "../../_shared/payment/types.ts";
import {
  handleScheduleNetcredChargesRequest,
  type ScheduleNetcredChargesDeps,
} from "../handleRequest.ts";
import { processSchedule, type ProcessScheduleDeps } from "../processSchedule.ts";
import { resolveCronChargeOutcome } from "../resolveCronChargeOutcome.ts";
import type { CronChargeSchedule } from "../types.ts";

const baseSchedule: CronChargeSchedule = {
  id: "schedule-1",
  contracted_service_id: "service-1",
  service_request_id: "sr-1",
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
    createCharge: async () => ({
      success: true,
      transactionState: "PAID",
      chargeId: "417417",
      transactionId: "tx-1",
    }),
    commitResult: async () => "schedule-1",
    loadHistoricalFailureCodes: async () => [],
    emitFailedPermanentWarning: () => {},
    ingestNotification: async () => {},
    maxAttempts: 3,
    ...overrides,
  };
}

Deno.test("PAID transition commits correctly", async () => {
  let committedOutcome: string | undefined;

  const result = await processSchedule(
    createProcessDeps({
      commitResult: async (input) => {
        committedOutcome = input.outcome;
        return "schedule-1";
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "PAID");
  assertEquals(committedOutcome, "PAID");
});

Deno.test("terminal error maps to FAILED_PERMANENT with attempt increment undone", async () => {
  let undoAttemptIncrement = false;

  await processSchedule(
    createProcessDeps({
      createCharge: async (): Promise<CreateChargeResult> => ({
        success: false,
        transactionState: "REJECTED",
        error: { code: "TERMINAL", message: "rejected", originalCode: "REJECTED" },
      }),
      commitResult: async (input) => {
        undoAttemptIncrement = input.undoAttemptIncrement;
        return "schedule-1";
      },
    }),
    baseSchedule,
  );

  assertEquals(undoAttemptIncrement, true);
});

Deno.test("retryable error maps to FAILED when attempts remain", () => {
  const resolved = resolveCronChargeOutcome(
    {
      success: false,
      error: { code: "RETRYABLE", message: "timeout" },
    },
    1,
    3,
  );

  assertEquals(resolved.outcome, "FAILED");
  assertEquals(resolved.undoAttemptIncrement, false);
});

Deno.test("retry with null getTransaction still issues createCharge", async () => {
  let getTransactionCalled = false;
  let createChargeCalled = false;

  await processSchedule(
    createProcessDeps({
      getTransaction: async () => {
        getTransactionCalled = true;
        return null;
      },
      createCharge: async () => {
        createChargeCalled = true;
        return { success: true, transactionState: "PAID" };
      },
    }),
    { ...baseSchedule, automatic_attempt_count: 2 },
  );

  assertEquals(getTransactionCalled, true);
  assertEquals(createChargeCalled, true);
});

Deno.test("REFERENCE_CODE_CONFLICT reconciles via getTransaction in processSchedule", async () => {
  let createChargeCalls = 0;

  const result = await processSchedule(
    createProcessDeps({
      getTransaction: async () => ({
        transactionId: "tx-conflict",
        referenceCode: "service-1",
        transactionState: "PAID",
        paidAmount: "1024.29",
        chargeId: "417417",
      }),
      createCharge: async () => {
        createChargeCalls += 1;
        return {
          success: false,
          error: {
            code: "REFERENCE_CODE_CONFLICT",
            message: "referenceCode already exists",
          },
        };
      },
    }),
    { ...baseSchedule, automatic_attempt_count: 1 },
  );

  assertEquals(createChargeCalls, 1);
  assertEquals(result.outcome, "PAID");
  assertEquals(result.reconciled, true);
});

Deno.test("getTransaction reconciliation skips createCharge on retry", async () => {
  let createChargeCalled = false;

  await processSchedule(
    createProcessDeps({
      getTransaction: async () => ({
        transactionId: "tx-existing",
        referenceCode: "service-1",
        transactionState: "PAID",
        paidAmount: "1024.29",
        chargeId: "417417",
      }),
      createCharge: async () => {
        createChargeCalled = true;
        return { success: true, transactionState: "PAID" };
      },
    }),
    { ...baseSchedule, automatic_attempt_count: 2 },
  );

  assertEquals(createChargeCalled, false);
});

Deno.test("dry run mode logs and reverts lease without charging", async () => {
  let processCalled = false;
  let revertedScheduleId: string | undefined;

  const previousServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const previousEnvironment = Deno.env.get("ENVIRONMENT");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");

  try {
    const deps: ScheduleNetcredChargesDeps = {
      dequeueSchedules: async () => [{ ...baseSchedule }],
      processSchedule: async () => {
        processCalled = true;
        return {
          scheduleId: "schedule-1",
          outcome: "PAID",
          chargeAmount: "1024.29",
        };
      },
      captureException: () => {},
      maxAttempts: 3,
      isDryRun: async () => true,
      revertDryRunLease: async (scheduleId) => {
        revertedScheduleId = scheduleId;
      },
    };

    const req = new Request("https://example.com/schedule-netcred-charges", {
      method: "POST",
      headers: { Authorization: "Bearer test-service-role" },
    });

    const response = await handleScheduleNetcredChargesRequest(req, deps);
    const summary = await response.json();

    assertEquals(summary.dry_run, 1);
    assertEquals(summary.paid, 0);
    assertEquals(processCalled, false);
    assertEquals(revertedScheduleId, "schedule-1");
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

Deno.test("concurrent invocations dequeue disjoint schedule sets", async () => {
  const dequeuedIds = new Set<string>();
  const previousServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const previousEnvironment = Deno.env.get("ENVIRONMENT");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");

  try {
    const deps: ScheduleNetcredChargesDeps = {
    dequeueSchedules: async () => {
      const id = dequeuedIds.has("schedule-1") ? null : "schedule-1";
      if (!id) {
        return [];
      }
      dequeuedIds.add(id);
      return [{ ...baseSchedule }];
    },
    processSchedule: async () => ({
      scheduleId: "schedule-1",
      outcome: "PAID",
      chargeAmount: "1024.29",
    }),
    captureException: () => {},
    maxAttempts: 3,
  };

  const req = new Request("https://example.com/schedule-netcred-charges", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-service-role",
    },
  });

  const first = await handleScheduleNetcredChargesRequest(req, deps);
  const second = await handleScheduleNetcredChargesRequest(req, deps);

  assertEquals((await first.json()).processed, 1);
  assertEquals((await second.json()).processed, 0);
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
