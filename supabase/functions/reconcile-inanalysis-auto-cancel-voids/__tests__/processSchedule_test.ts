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
