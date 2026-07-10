import { assertEquals } from "std/testing/asserts";
import {
  processInanalysisVoidSchedule,
  type ProcessInanalysisVoidDeps,
} from "../processSchedule.ts";
import type { InanalysisVoidSchedule } from "../types.ts";

const baseSchedule: InanalysisVoidSchedule = {
  id: "schedule-1",
  contracted_service_id: "service-1",
  client_id: "client-1",
  provider_id: "provider-1",
  gateway_charge_id: "9001",
  gateway_transaction_id: "txn-1",
  netcred_company_id: "1048",
  reconciliation_failure_count: 0,
};

function createDeps(
  overrides: Partial<ProcessInanalysisVoidDeps> = {},
): ProcessInanalysisVoidDeps {
  return {
    getTransaction: async () => ({
      transactionId: "txn-1",
      chargeId: "9001",
      referenceCode: "service-1",
      transactionState: "IN_ANALYSIS",
    }),
    voidCharge: async () => ({ success: true }),
    commitOutcome: async () => ({ applied: true }),
    emitWarning: () => {},
    ...overrides,
  };
}

Deno.test("processInanalysisVoidSchedule voids uncaptured IN_ANALYSIS charge", async () => {
  const committed: string[] = [];

  const result = await processInanalysisVoidSchedule(
    createDeps({
      commitOutcome: async (input) => {
        committed.push(input.outcome);
        return { applied: true };
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "VOIDED");
  assertEquals(committed, ["voided"]);
});

Deno.test("processInanalysisVoidSchedule defers when gateway is already PAID", async () => {
  const warnings: string[] = [];

  const result = await processInanalysisVoidSchedule(
    createDeps({
      getTransaction: async () => ({
        transactionId: "txn-1",
        chargeId: "9001",
        referenceCode: "service-1",
        transactionState: "PAID",
        paidAmount: "310.39",
      }),
      commitOutcome: async (input) => {
        assertEquals(input.outcome, "deferred_captured");
        return { applied: true };
      },
      emitWarning: (extra) => {
        warnings.push(String(extra.reason));
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "DEFERRED");
  assertEquals(warnings, ["gateway_already_captured"]);
});

Deno.test("processInanalysisVoidSchedule records failure when voidCharge fails", async () => {
  const result = await processInanalysisVoidSchedule(
    createDeps({
      voidCharge: async () => ({
        success: false,
        error: { code: "RETRYABLE", message: "gateway_busy" },
      }),
      commitOutcome: async () => ({
        applied: true,
        reconciliation_failure_count: 2,
      }),
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "FAILURE");
  assertEquals(result.failureCount, 2);
});

Deno.test("processInanalysisVoidSchedule fails when netcred_company_id is missing", async () => {
  let committed: string | undefined;

  const result = await processInanalysisVoidSchedule(
    createDeps({
      commitOutcome: async (input) => {
        committed = input.errorMessage;
        return { applied: true, reconciliation_failure_count: 1 };
      },
      getTransaction: async () => {
        throw new Error("should not call getTransaction");
      },
    }),
    { ...baseSchedule, netcred_company_id: null },
  );

  assertEquals(result.outcome, "FAILURE");
  assertEquals(result.failureCount, 1);
  assertEquals(committed, "NETCRED_COMPANY_ID_REQUIRED");
});

Deno.test("processInanalysisVoidSchedule fails when getTransaction throws", async () => {
  const result = await processInanalysisVoidSchedule(
    createDeps({
      getTransaction: async () => {
        throw new Error("gateway timeout");
      },
      commitOutcome: async (input) => {
        assertEquals(input.outcome, "failed");
        assertEquals(input.errorMessage, "gateway timeout");
        return { applied: true, reconciliation_failure_count: 3 };
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "FAILURE");
  assertEquals(result.failureCount, 3);
});

Deno.test("processInanalysisVoidSchedule fails when gateway_charge_id is missing", async () => {
  let errorMessage: string | undefined;

  const result = await processInanalysisVoidSchedule(
    createDeps({
      commitOutcome: async (input) => {
        errorMessage = input.errorMessage;
        return { applied: true, reconciliation_failure_count: 1 };
      },
      voidCharge: async () => {
        throw new Error("voidCharge should not run");
      },
    }),
    { ...baseSchedule, gateway_charge_id: "  " },
  );

  assertEquals(result.outcome, "FAILURE");
  assertEquals(errorMessage, "gateway_charge_id_missing");
});

Deno.test("processInanalysisVoidSchedule marks VOIDED gateway as ALREADY_TERMINAL", async () => {
  let committed: string | undefined;

  const result = await processInanalysisVoidSchedule(
    createDeps({
      getTransaction: async () => ({
        transactionId: "txn-1",
        chargeId: "9001",
        referenceCode: "service-1",
        transactionState: "VOIDED",
      }),
      commitOutcome: async (input) => {
        committed = input.outcome;
        return { applied: true };
      },
      voidCharge: async () => {
        throw new Error("voidCharge should not run");
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "ALREADY_TERMINAL");
  assertEquals(committed, "already_terminal");
});

Deno.test("processInanalysisVoidSchedule retries when gateway state is missing", async () => {
  const result = await processInanalysisVoidSchedule(
    createDeps({
      getTransaction: async () => null,
      commitOutcome: async (input) => {
        assertEquals(input.outcome, "failed");
        assertEquals(input.errorMessage, "gateway_state_missing");
        return { applied: true, reconciliation_failure_count: 2 };
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "FAILURE");
  assertEquals(result.failureCount, 2);
});

Deno.test("processInanalysisVoidSchedule stringifies non-Error getTransaction failures", async () => {
  const result = await processInanalysisVoidSchedule(
    createDeps({
      getTransaction: async () => {
        throw "timeout";
      },
      commitOutcome: async (input) => {
        assertEquals(input.errorMessage, "timeout");
        return { applied: true, reconciliation_failure_count: 1 };
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "FAILURE");
  assertEquals(result.failureCount, 1);
});

Deno.test("processInanalysisVoidSchedule retries unsupported gateway states", async () => {
  let errorMessage: string | undefined;

  const result = await processInanalysisVoidSchedule(
    createDeps({
      getTransaction: async () => ({
        transactionId: "txn-1",
        chargeId: "9001",
        referenceCode: "service-1",
        transactionState: "UNKNOWN_STATE" as never,
      }),
      commitOutcome: async (input) => {
        errorMessage = input.errorMessage;
        return { applied: true, reconciliation_failure_count: 1 };
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "FAILURE");
  assertEquals(errorMessage, "unsupported_gateway_state:UNKNOWN_STATE");
});

Deno.test("processInanalysisVoidSchedule defaults void error message when missing", async () => {
  let errorMessage: string | undefined;

  const result = await processInanalysisVoidSchedule(
    createDeps({
      voidCharge: async () => ({
        success: false,
      }),
      commitOutcome: async (input) => {
        errorMessage = input.errorMessage;
        return { applied: true, reconciliation_failure_count: 1 };
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "FAILURE");
  assertEquals(errorMessage, "charge_void_failed");
});