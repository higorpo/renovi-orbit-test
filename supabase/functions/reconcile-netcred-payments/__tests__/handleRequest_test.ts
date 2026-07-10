import { assertEquals } from "std/testing/asserts";
import {
  handleReconcileNetcredPaymentsRequest,
  type ReconcileNetcredPaymentsDeps,
} from "../handleRequest.ts";
import {
  processReconcileSchedule,
  type ProcessReconcileScheduleDeps,
} from "../processSchedule.ts";
import type { ReconcileSchedule } from "../types.ts";

function createDeps(
  overrides: Partial<ReconcileNetcredPaymentsDeps> = {},
): ReconcileNetcredPaymentsDeps {
  return {
    listStaleSchedules: async () => [],
    processSchedule: async () => ({
      scheduleId: "schedule-1",
      outcome: "SKIPPED",
    }),
    ...overrides,
  };
}

function cronRequest(): Request {
  return new Request("https://example.com/reconcile-netcred-payments", {
    method: "POST",
    headers: { Authorization: "Bearer test-service-role" },
  });
}

const inAnalysisSchedule: ReconcileSchedule = {
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

Deno.test("IN_ANALYSIS schedule reconciles to PAID without EF-side notification enqueue", async () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");
  try {
    const response = await handleReconcileNetcredPaymentsRequest(
      cronRequest(),
      createDeps({
        listStaleSchedules: async () => [inAnalysisSchedule],
        processSchedule: async () => {
          const deps: ProcessReconcileScheduleDeps = {
            getTransaction: async () => ({
              transactionId: "txn-1",
              chargeId: "charge-1",
              referenceCode: "service-1",
              transactionState: "PAID",
              paidAmount: "310.39",
            }),
            applyGatewayState: async () => ({
              applied: true,
              from_state: "IN_ANALYSIS",
              to_state: "PAID",
              service_id: "service-1",
              client_id: "client-1",
              provider_id: "provider-1",
              installment_number: 1,
              charge_amount: "310.39",
            }),
            incrementFailureCount: async () => 0,
            emitWarning: () => {},
          };

          return processReconcileSchedule(deps, inAnalysisSchedule);
        },
      }),
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.processed, 1);
    assertEquals(body.applied, 1);
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("ENVIRONMENT");
  }
});

Deno.test("network error increments failure count and emits warning", async () => {
  const warnings: Record<string, unknown>[] = [];

  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");
  try {
    const deps: ProcessReconcileScheduleDeps = {
      getTransaction: async () => {
        throw new Error("gateway unavailable");
      },
      applyGatewayState: async () => ({ applied: false }),
      incrementFailureCount: async () => 4,
      emitWarning: (extra) => {
        warnings.push(extra);
      },
    };

    const result = await processReconcileSchedule(deps, inAnalysisSchedule);

    assertEquals(result.outcome, "FAILURE");
    assertEquals(result.failureCount, 4);
    assertEquals(warnings.length, 1);
    assertEquals(warnings[0]?.reason, "network_error");
    assertEquals(warnings[0]?.reconciliation_failure_count, 4);
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("ENVIRONMENT");
  }
});

Deno.test("gateway null response increments failure count and warns after threshold", async () => {
  const warnings: Record<string, unknown>[] = [];

  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");
  try {
    const deps: ProcessReconcileScheduleDeps = {
      getTransaction: async () => null,
      applyGatewayState: async () => ({ applied: false }),
      incrementFailureCount: async () => 4,
      emitWarning: (extra) => {
        warnings.push(extra);
      },
    };

    const result = await processReconcileSchedule(deps, inAnalysisSchedule);

    assertEquals(result.outcome, "FAILURE");
    assertEquals(result.failureCount, 4);
    assertEquals(warnings.length, 1);
    assertEquals(warnings[0]?.reason, "gateway_null");
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("ENVIRONMENT");
  }
});

Deno.test("same-state IN_ANALYSIS skip does not call applyGatewayState", async () => {
  let applyCalled = false;

  const result = await processReconcileSchedule(
    {
      getTransaction: async () => ({
        transactionId: "txn-1",
        chargeId: "charge-1",
        referenceCode: "service-1",
        transactionState: "IN_ANALYSIS",
      }),
      applyGatewayState: async () => {
        applyCalled = true;
        return { applied: false };
      },
      incrementFailureCount: async () => 0,
      emitWarning: () => {},
    },
    inAnalysisSchedule,
  );

  assertEquals(result.outcome, "SKIPPED");
  assertEquals(result.failureCount, 0);
  assertEquals(applyCalled, false);
});

Deno.test("missing netcred_company_id increments failure and emits network_error warning", async () => {
  const warnings: Record<string, unknown>[] = [];

  const result = await processReconcileSchedule(
    {
      getTransaction: async () => null,
      applyGatewayState: async () => ({ applied: false }),
      incrementFailureCount: async () => 1,
      emitWarning: (extra) => {
        warnings.push(extra);
      },
    },
    { ...inAnalysisSchedule, netcred_company_id: null },
  );

  assertEquals(result.outcome, "FAILURE");
  assertEquals(result.failureCount, 1);
  assertEquals(warnings[0]?.reason, "network_error");
  assertEquals(warnings[0]?.error, "NETCRED_COMPANY_ID_REQUIRED");
});

Deno.test("applyGatewayState PAID returns charge_amount on processed result", async () => {
  const result = await processReconcileSchedule(
    {
      getTransaction: async () => ({
        transactionId: "txn-1",
        chargeId: "charge-1",
        referenceCode: "service-1",
        transactionState: "PAID",
        paidAmount: "310.39",
      }),
      applyGatewayState: async () => ({
        applied: true,
        from_state: "IN_ANALYSIS",
        to_state: "PAID",
        charge_amount: "310.39",
      }),
      incrementFailureCount: async () => 0,
      emitWarning: () => {},
    },
    inAnalysisSchedule,
  );

  assertEquals(result.outcome, "PAID");
  assertEquals(result.chargeAmount, "310.39");
});

Deno.test("applyGatewayState maps REFUNDED / FAILED_PERMANENT / PARTIALLY_REFUNDED outcomes", async () => {
  const cases: Array<{ to_state: string; expected: string }> = [
    { to_state: "REFUNDED", expected: "REFUNDED" },
    { to_state: "FAILED_PERMANENT", expected: "FAILED_PERMANENT" },
    { to_state: "PARTIALLY_REFUNDED", expected: "PARTIALLY_REFUNDED" },
  ];

  for (const { to_state, expected } of cases) {
    const result = await processReconcileSchedule(
      {
        getTransaction: async () => ({
          transactionId: "txn-1",
          chargeId: "charge-1",
          referenceCode: "service-1",
          transactionState: "PAID",
        }),
        applyGatewayState: async () => ({
          applied: true,
          to_state,
        }),
        incrementFailureCount: async () => 0,
        emitWarning: () => {},
      },
      inAnalysisSchedule,
    );

    assertEquals(result.outcome, expected);
  }
});

Deno.test("applyGatewayState not applied returns SKIPPED with failure count", async () => {
  const result = await processReconcileSchedule(
    {
      getTransaction: async () => ({
        transactionId: "txn-1",
        chargeId: "charge-1",
        referenceCode: "service-1",
        transactionState: "PAID",
      }),
      applyGatewayState: async () => ({
        applied: false,
        reason: "still_in_analysis",
        reconciliation_failure_count: 2,
      }),
      incrementFailureCount: async () => 0,
      emitWarning: () => {},
    },
    inAnalysisSchedule,
  );

  assertEquals(result.outcome, "SKIPPED");
  assertEquals(result.failureCount, 2);
});

Deno.test("applyGatewayState not applied without still_in_analysis still skips", async () => {
  const result = await processReconcileSchedule(
    {
      getTransaction: async () => ({
        transactionId: "txn-1",
        chargeId: "charge-1",
        referenceCode: "service-1",
        transactionState: "PAID",
      }),
      applyGatewayState: async () => ({
        applied: false,
        reason: "race_lost",
        reconciliation_failure_count: 1,
      }),
      incrementFailureCount: async () => 0,
      emitWarning: () => {},
    },
    inAnalysisSchedule,
  );

  assertEquals(result.outcome, "SKIPPED");
  assertEquals(result.failureCount, 1);
});

Deno.test("applyGatewayState IN_ANALYSIS to_state maps to IN_ANALYSIS outcome", async () => {
  const result = await processReconcileSchedule(
    {
      getTransaction: async () => ({
        transactionId: "txn-1",
        chargeId: "charge-1",
        referenceCode: "service-1",
        transactionState: "PAID",
      }),
      applyGatewayState: async () => ({
        applied: true,
        to_state: "IN_ANALYSIS",
      }),
      incrementFailureCount: async () => 0,
      emitWarning: () => {},
    },
    inAnalysisSchedule,
  );

  assertEquals(result.outcome, "IN_ANALYSIS");
});

Deno.test("applyGatewayState unknown to_state maps to SKIPPED", async () => {
  const result = await processReconcileSchedule(
    {
      getTransaction: async () => ({
        transactionId: "txn-1",
        chargeId: "charge-1",
        referenceCode: "service-1",
        transactionState: "PAID",
      }),
      applyGatewayState: async () => ({
        applied: true,
        to_state: "UNEXPECTED_STATE",
      }),
      incrementFailureCount: async () => 0,
      emitWarning: () => {},
    },
    inAnalysisSchedule,
  );

  assertEquals(result.outcome, "SKIPPED");
});

Deno.test("getTransaction non-Error throw is stringified in warning", async () => {
  const warnings: Record<string, unknown>[] = [];

  const result = await processReconcileSchedule(
    {
      getTransaction: async () => {
        throw "network-down";
      },
      applyGatewayState: async () => ({ applied: false }),
      incrementFailureCount: async () => 2,
      emitWarning: (extra) => {
        warnings.push(extra);
      },
    },
    inAnalysisSchedule,
  );

  assertEquals(result.outcome, "FAILURE");
  assertEquals(warnings[0]?.error, "network-down");
});

Deno.test("handleRequest summary buckets applied, skipped, failures and warnings", async () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  Deno.env.set("ENVIRONMENT", "development");
  try {
    const schedules: ReconcileSchedule[] = [
      { ...inAnalysisSchedule, id: "s-paid" },
      { ...inAnalysisSchedule, id: "s-skip" },
      { ...inAnalysisSchedule, id: "s-fail" },
      { ...inAnalysisSchedule, id: "s-throw" },
    ];

    const response = await handleReconcileNetcredPaymentsRequest(
      cronRequest(),
      createDeps({
        listStaleSchedules: async () => schedules,
        processSchedule: async (schedule) => {
          if (schedule.id === "s-paid") {
            return { scheduleId: schedule.id, outcome: "PAID", chargeAmount: "10.00" };
          }
          if (schedule.id === "s-skip") {
            return { scheduleId: schedule.id, outcome: "SKIPPED" };
          }
          if (schedule.id === "s-fail") {
            return { scheduleId: schedule.id, outcome: "FAILURE", failureCount: 4 };
          }
          throw new Error("boom");
        },
      }),
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.processed, 4);
    assertEquals(body.applied, 1);
    assertEquals(body.skipped, 1);
    assertEquals(body.failures, 2);
    assertEquals(body.warnings_emitted, 1);
  } finally {
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    Deno.env.delete("ENVIRONMENT");
  }
});

Deno.test("handleRequest OPTIONS returns 204 and non-POST returns 405", async () => {
  const options = await handleReconcileNetcredPaymentsRequest(
    new Request("https://example.com/reconcile-netcred-payments", { method: "OPTIONS" }),
    createDeps(),
  );
  assertEquals(options.status, 204);

  const get = await handleReconcileNetcredPaymentsRequest(
    new Request("https://example.com/reconcile-netcred-payments", { method: "GET" }),
    createDeps(),
  );
  assertEquals(get.status, 405);
});
