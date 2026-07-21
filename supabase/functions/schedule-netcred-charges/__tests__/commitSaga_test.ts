import { assertEquals, assertRejects } from "std/testing/asserts";
import type { CreateChargeResult } from "../../_shared/payment/types.ts";
import { processSchedule, type ProcessScheduleDeps } from "../processSchedule.ts";
import type { CronChargeSchedule } from "../types.ts";

const baseSchedule: CronChargeSchedule = {
  id: "schedule-1",
  contracted_service_id: "service-1",
  service_request_id: "sr-1",
  service_request_title: "Pintura",
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
  gateway_reference_code: "ref-service-1",
};

function createDeps(
  overrides: Partial<ProcessScheduleDeps> = {},
): ProcessScheduleDeps {
  return {
    calculateChargeAmount: async () => "1024.29",
    loadPaymentToken: async () => ({
      gateway_payment_profile_id: "403137",
      gateway_card_token: "tok_abc",
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

Deno.test("gateway PAID + commit throw → getTransaction + commit retry succeeds", async () => {
  let commitCalls = 0;
  let getTransactionCalls = 0;
  let criticalEmitted = false;

  const result = await processSchedule(
    createDeps({
      commitResult: async (input) => {
        commitCalls += 1;
        if (commitCalls === 1) {
          throw new Error(
            "payment_commit_charge_outcome failed: connection reset (code=57014)",
          );
        }
        assertEquals(input.outcome, "PAID");
        return input.scheduleId;
      },
      getTransaction: async (input) => {
        getTransactionCalls += 1;
        assertEquals(input.referenceCode, "ref-service-1");
        assertEquals(input.companyId, "1048");
        return {
          transactionState: "PAID",
          chargeId: "417417",
          transactionId: "tx-1",
          paidAmount: "1024.29",
        };
      },
      emitCommitAfterSuccessCritical: () => {
        criticalEmitted = true;
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "PAID");
  assertEquals(commitCalls, 2);
  assertEquals(getTransactionCalls, 1);
  assertEquals(criticalEmitted, false);
});

Deno.test("gateway PAID + commit retry still fails → CRITICAL and leaves PROCESSING (rethrows)", async () => {
  let criticalError: string | undefined;
  let commitCalls = 0;

  await assertRejects(
    () =>
      processSchedule(
        createDeps({
          commitResult: async () => {
            commitCalls += 1;
            throw new Error(
              "payment_commit_charge_outcome failed: INVALID_SCHEDULE_STATE (code=P0001)",
            );
          },
          getTransaction: async () => ({
            transactionState: "PAID",
            chargeId: "417417",
            transactionId: "tx-1",
            paidAmount: "1024.29",
          }),
          emitCommitAfterSuccessCritical: (input) => {
            criticalError = input.error;
          },
        }),
        baseSchedule,
      ),
    Error,
    "payment_commit_charge_outcome failed: INVALID_SCHEDULE_STATE (code=P0001)",
  );

  assertEquals(commitCalls, 2);
  assertEquals(
    criticalError,
    "payment_commit_charge_outcome failed: INVALID_SCHEDULE_STATE (code=P0001)",
  );
});

Deno.test("MMD enqueue failure after PAID commit does not fail charge outcome", async () => {
  let committed = false;

  const result = await processSchedule(
    createDeps({
      commitResult: async (input) => {
        committed = true;
        assertEquals(input.outcome, "PAID");
        return input.scheduleId;
      },
      ingestNotification: async () => {
        throw new Error("mmd_ingest unavailable");
      },
    }),
    baseSchedule,
  );

  assertEquals(committed, true);
  assertEquals(result.outcome, "PAID");
});

Deno.test("gateway rejection commit failure still propagates without getTransaction retry", async () => {
  let getTransactionCalls = 0;

  await assertRejects(
    () =>
      processSchedule(
        createDeps({
          createCharge: async (): Promise<CreateChargeResult> => ({
            success: false,
            transactionState: "REJECTED",
            error: {
              code: "RETRYABLE",
              message: "network",
              originalCode: "NETWORK_ERROR",
            },
          }),
          commitResult: async () => {
            throw new Error(
              "payment_commit_charge_outcome failed: INVALID_SCHEDULE_STATE (code=P0001)",
            );
          },
          getTransaction: async () => {
            getTransactionCalls += 1;
            return null;
          },
        }),
        baseSchedule,
      ),
    Error,
    "payment_commit_charge_outcome failed: INVALID_SCHEDULE_STATE (code=P0001)",
  );

  assertEquals(getTransactionCalls, 0);
});
