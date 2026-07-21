import { assertEquals } from "std/testing/asserts";
import type { CreateChargeResult } from "../../_shared/payment/types.ts";
import { ProviderAuthError } from "../../_shared/payment/errors.ts";
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
      netcred_company_id: "1014",
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
    platformCompanyId: "1014",
    isProduction: false,
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

Deno.test("OPTIONS returns 204 for schedule-netcred-charges", async () => {
  const response = await handleScheduleNetcredChargesRequest(
    new Request("https://example.com/schedule-netcred-charges", { method: "OPTIONS" }),
    {
      dequeueSchedules: async () => [],
      processSchedule: async () => ({ scheduleId: "x", outcome: "PAID" }),
      captureException: () => {},
      maxAttempts: 3,
    },
  );
  assertEquals(response.status, 204);
});

Deno.test("non-POST returns 405 for schedule-netcred-charges", async () => {
  const response = await handleScheduleNetcredChargesRequest(
    new Request("https://example.com/schedule-netcred-charges", { method: "GET" }),
    {
      dequeueSchedules: async () => [],
      processSchedule: async () => ({ scheduleId: "x", outcome: "PAID" }),
      captureException: () => {},
      maxAttempts: 3,
    },
  );
  assertEquals(response.status, 405);
});

Deno.test("unauthorized cron request returns auth error", async () => {
  const previousServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  try {
    const response = await handleScheduleNetcredChargesRequest(
      new Request("https://example.com/schedule-netcred-charges", {
        method: "POST",
        headers: { Authorization: "Bearer wrong" },
      }),
      {
        dequeueSchedules: async () => [],
        processSchedule: async () => ({ scheduleId: "x", outcome: "PAID" }),
        captureException: () => {},
        maxAttempts: 3,
      },
    );
    assertEquals(response.status >= 400, true);
  } finally {
    if (previousServiceRoleKey === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", previousServiceRoleKey);
    }
  }
});

Deno.test("summary buckets cover all outcomes including reconciled and errors", async () => {
  const previousServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const previousEnvironment = Deno.env.get("ENVIRONMENT");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");

  const outcomes = [
    { scheduleId: "s1", outcome: "PAID" as const, reconciled: true },
    { scheduleId: "s2", outcome: "FAILED" as const },
    { scheduleId: "s3", outcome: "FAILED_PERMANENT" as const },
    { scheduleId: "s4", outcome: "IN_ANALYSIS" as const },
  ];
  let index = 0;

  try {
    const response = await handleScheduleNetcredChargesRequest(
      new Request("https://example.com/schedule-netcred-charges", {
        method: "POST",
        headers: { Authorization: "Bearer test-service-role" },
      }),
      {
        dequeueSchedules: async () =>
          outcomes.map((o, i) => ({ ...baseSchedule, id: `schedule-${i}` })),
        processSchedule: async () => {
          const next = outcomes[index++]!;
          if (next.scheduleId === "s-error") {
            throw new Error("boom");
          }
          return next;
        },
        captureException: () => {},
        maxAttempts: 3,
      },
    );

    // Second request to exercise error path with one schedule
    const errorResponse = await handleScheduleNetcredChargesRequest(
      new Request("https://example.com/schedule-netcred-charges", {
        method: "POST",
        headers: { Authorization: "Bearer test-service-role" },
      }),
      {
        dequeueSchedules: async () => [{ ...baseSchedule, id: "schedule-err" }],
        processSchedule: async () => {
          throw "string-error";
        },
        captureException: () => {},
        maxAttempts: 3,
      },
    );

    assertEquals(response.status, 200);
    const summary = await response.json();
    assertEquals(summary.processed, 4);
    assertEquals(summary.paid, 1);
    assertEquals(summary.failed, 1);
    assertEquals(summary.failed_permanent, 1);
    assertEquals(summary.in_analysis, 1);
    assertEquals(summary.reconciled, 1);

    assertEquals(errorResponse.status, 200);
    const errorSummary = await errorResponse.json();
    assertEquals(errorSummary.errors, 1);
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

Deno.test("processSchedule throws when payment token is missing", async () => {
  let threw = false;
  try {
    await processSchedule(
      createProcessDeps({
        loadPaymentToken: async () => null,
      }),
      baseSchedule,
    );
  } catch (error) {
    threw = error instanceof Error && error.message === "PAYMENT_TOKEN_NOT_FOUND";
  }
  assertEquals(threw, true);
});

Deno.test("processSchedule throws when provider is not credentialed", async () => {
  let threw = false;
  try {
    await processSchedule(
      createProcessDeps({
        loadProviderAccount: async () => ({
          netcred_company_id: null,
          netcred_bank_account_id: null,
          onboarding_status: "PENDING",
        }),
      }),
      baseSchedule,
    );
  } catch (error) {
    threw = error instanceof Error && error.message === "PROVIDER_NOT_CREDENTIALED";
  }
  assertEquals(threw, true);
});

Deno.test("processSchedule throws when charge amount calculation fails", async () => {
  let threw = false;
  try {
    await processSchedule(
      createProcessDeps({
        calculateChargeAmount: async () => null as never,
      }),
      { ...baseSchedule, charge_amount: null },
    );
  } catch (error) {
    threw = error instanceof Error &&
      error.message === "CHARGE_AMOUNT_CALCULATION_FAILED";
  }
  assertEquals(threw, true);
});

Deno.test("processSchedule uses schedule.charge_amount when present", async () => {
  let calculated = false;
  const result = await processSchedule(
    createProcessDeps({
      calculateChargeAmount: async () => {
        calculated = true;
        return "999.00";
      },
    }),
    { ...baseSchedule, charge_amount: 1024.29, provider_payout: 850 },
  );
  assertEquals(calculated, false);
  assertEquals(result.outcome, "PAID");
});

Deno.test("processSchedule continues when clearsale_session_id is missing in non-production", async () => {
  const result = await processSchedule(
    createProcessDeps({ isProduction: false }),
    { ...baseSchedule, clearsale_session_id: null, client_ip_address: null },
  );
  assertEquals(result.outcome, "PAID");
});

Deno.test("processSchedule fails closed without createCharge when clearsale_session_id missing in production", async () => {
  let createChargeCalled = false;
  let committed: {
    outcome?: string;
    failureCode?: string;
    undoAttemptIncrement?: boolean;
  } = {};

  const result = await processSchedule(
    createProcessDeps({
      isProduction: true,
      createCharge: async () => {
        createChargeCalled = true;
        return {
          success: true,
          transactionState: "PAID",
          chargeId: "should-not-run",
          transactionId: "tx-x",
        };
      },
      commitResult: async (input) => {
        committed = {
          outcome: input.outcome,
          failureCode: input.failureCode,
          undoAttemptIncrement: input.undoAttemptIncrement,
        };
        return "schedule-1";
      },
    }),
    { ...baseSchedule, clearsale_session_id: null, client_ip_address: null },
  );

  assertEquals(createChargeCalled, false);
  assertEquals(result.outcome, "FAILED");
  assertEquals(committed.outcome, "FAILED");
  assertEquals(committed.failureCode, "MISSING_CLEARSALE_SESSION_ID");
  assertEquals(committed.undoAttemptIncrement, true);
});

Deno.test("processSchedule reconciles REJECTED existing transaction", async () => {
  const result = await processSchedule(
    createProcessDeps({
      getTransaction: async () => ({
        transactionId: "tx-rej",
        referenceCode: "service-1",
        transactionState: "REJECTED",
        chargeId: "c-rej",
      }),
      createCharge: async () => {
        throw new Error("should not create");
      },
    }),
    { ...baseSchedule, automatic_attempt_count: 2 },
  );
  assertEquals(result.outcome, "FAILED_PERMANENT");
  assertEquals(result.reconciled, true);
});


Deno.test("processSchedule maps ProviderAuthError to FAILED with auth_failure", async () => {
  const result = await processSchedule(
    createProcessDeps({
      createCharge: async () => {
        throw new ProviderAuthError("NETCRED_AUTH_FAILURE");
      },
    }),
    baseSchedule,
  );
  assertEquals(result.outcome, "FAILED");
});
