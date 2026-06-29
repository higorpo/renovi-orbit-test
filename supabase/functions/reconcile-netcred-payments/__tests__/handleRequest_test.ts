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

Deno.test("IN_ANALYSIS schedule reconciles to PAID with client notifications", async () => {
  const ingested: string[] = [];

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
            ingestNotification: async (input) => {
              ingested.push(`${input.profileId}:${input.templateKey}`);
            },
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
    assertEquals(ingested.includes("client-1:payment_success"), true);
    assertEquals(ingested.includes("provider-1:provider_payment_confirmed"), true);
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
      ingestNotification: async () => {},
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
      ingestNotification: async () => {},
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
