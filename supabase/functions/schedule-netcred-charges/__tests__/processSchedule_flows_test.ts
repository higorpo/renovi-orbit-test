import { assertEquals, assertRejects } from "std/testing/asserts";
import type { CreateChargeInput, CreateChargeResult } from "../../_shared/payment/types.ts";
import { processSchedule, type ProcessScheduleDeps } from "../processSchedule.ts";
import type { CronChargeSchedule } from "../types.ts";

const baseSchedule: CronChargeSchedule = {
  id: "schedule-1",
  contracted_service_id: "service-1",
  service_request_id: "sr-1",
  service_request_title: "Pintura — Sala",
  client_id: "client-1",
  provider_id: "provider-1",
  gateway_slug: "netcred",
  client_card_token_id: "token-1",
  provider_payout: 850,
  netcred_company_id: "1048",
  installment_number: 2,
  base_amount: 1000,
  automatic_attempt_count: 1,
  max_attempts: 3,
  clearsale_session_id: "clearsale-session-uuid",
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

Deno.test("IN_ANALYSIS chargeCreate commits IN_ANALYSIS and notifies antifraud hold", async () => {
  let committedOutcome: string | undefined;
  let notificationEvent: string | undefined;

  const result = await processSchedule(
    createDeps({
      createCharge: async (): Promise<CreateChargeResult> => ({
        success: true,
        transactionState: "IN_ANALYSIS",
        chargeId: "417418",
        transactionId: "tx-analysis",
      }),
      commitResult: async (input) => {
        committedOutcome = input.outcome;
        return input.scheduleId;
      },
      ingestNotification: async (_scheduleId, event) => {
        notificationEvent = event;
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "IN_ANALYSIS");
  assertEquals(committedOutcome, "IN_ANALYSIS");
  assertEquals(notificationEvent, "CHARGE_IN_ANALYSIS");
});

Deno.test("FAILED_PERMANENT emits warning with historical + current failure codes", async () => {
  let warningCodes: string[] | undefined;

  const result = await processSchedule(
    createDeps({
      createCharge: async () => ({
        success: false,
        transactionState: "REJECTED",
        error: {
          code: "TERMINAL",
          message: "Card declined",
          originalCode: "REJECTED",
        },
      }),
      loadHistoricalFailureCodes: async () => ["NETWORK_ERROR", "REJECTED"],
      emitFailedPermanentWarning: (input) => {
        warningCodes = input.failure_codes;
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "FAILED_PERMANENT");
  assertEquals(warningCodes, ["NETWORK_ERROR", "REJECTED", "TERMINAL"]);
});

Deno.test("chargeCreate input matches NetCred card+split contract fields", async () => {
  let captured: CreateChargeInput | undefined;

  await processSchedule(
    createDeps({
      createCharge: async (input) => {
        captured = input;
        return {
          success: true,
          transactionState: "PAID",
          chargeId: "417417",
          transactionId: "tx-1",
        };
      },
    }),
    baseSchedule,
  );

  assertEquals(captured?.referenceCode, "ref-service-1");
  assertEquals(captured?.amount, "1024.29");
  assertEquals(captured?.serviceTitle, "Pintura — Sala");
  assertEquals(captured?.sessionId, "clearsale-session-uuid");
  assertEquals(captured?.customerIpAddress, "189.0.0.1");
  assertEquals(captured?.paymentMethod.type, "CREDIT_CARD");
  assertEquals(captured?.paymentMethod.installmentNumber, 2);
  assertEquals(captured?.paymentMethod.paymentProfileId, "403137");
  assertEquals(captured?.paymentMethod.paymentToken, "tok_abc");
  assertEquals(
    captured?.payoutRule.providerAccount.netcredCompanyId,
    "1048",
  );
  assertEquals(
    captured?.payoutRule.providerAccount.netcredBankAccountId,
    "2053",
  );
  assertEquals(captured?.payoutRule.ruleItems.length > 0, true);
});

Deno.test("nullish provider_payout still builds NetCred FIXED_AMOUNT split item", async () => {
  let captured: CreateChargeInput | undefined;

  const result = await processSchedule(
    createDeps({
      createCharge: async (input) => {
        captured = input;
        return {
          success: true,
          transactionState: "PAID",
          chargeId: "417417",
          transactionId: "tx-1",
        };
      },
    }),
    // Covers scheduleForCharge fallback (?? base_amount) applied before toFixed.
    { ...baseSchedule, provider_payout: null as unknown as number },
  );

  assertEquals(result.outcome, "PAID");
  const fixedItem = captured?.payoutRule.ruleItems.find(
    (item) => item.type === "FIXED_AMOUNT",
  );
  assertEquals(fixedItem?.amount, "1000.00");
  assertEquals(
    captured?.payoutRule.ruleItems.some((item) => item.type === "PERCENTAGE"),
    true,
  );
});

Deno.test("non-auth gateway errors are rethrown (not mapped to FAILED)", async () => {
  await assertRejects(
    () =>
      processSchedule(
        createDeps({
          createCharge: async () => {
            throw new Error("unexpected adapter crash");
          },
        }),
        baseSchedule,
      ),
    Error,
    "unexpected adapter crash",
  );
});

Deno.test("reconciled REJECTED uses rejectedReason as failure message", async () => {
  let failureReason: string | undefined;
  let failureCode: string | undefined;

  const result = await processSchedule(
    createDeps({
      getTransaction: async () => ({
        transactionId: "tx-rej",
        referenceCode: "ref-service-1",
        transactionState: "REJECTED",
        chargeId: "c-rej",
        rejectedReason: "Risk analysis rejected",
      }),
      createCharge: async () => {
        throw new Error("should not createCharge when reconciled REJECTED");
      },
      commitResult: async (input) => {
        failureReason = input.failureReason;
        failureCode = input.failureCode;
        return input.scheduleId;
      },
    }),
    { ...baseSchedule, automatic_attempt_count: 2 },
  );

  assertEquals(result.outcome, "FAILED_PERMANENT");
  assertEquals(result.reconciled, true);
  assertEquals(failureReason, "Risk analysis rejected");
  assertEquals(typeof failureCode, "string");
});

Deno.test("getTransaction uses provider company id on charge reconcile", async () => {
  let capturedCompanyId: string | null | undefined;

  await processSchedule(
    createDeps({
      getTransaction: async (input) => {
        capturedCompanyId = input.companyId;
        return {
          transactionId: "tx-1",
          referenceCode: "ref-service-1",
          transactionState: "PAID",
          paidAmount: "1024.29",
          chargeId: "417417",
        };
      },
      createCharge: async () => {
        throw new Error("should reconcile without createCharge");
      },
    }),
    {
      ...baseSchedule,
      automatic_attempt_count: 2,
      netcred_company_id: " 1048 ",
    },
  );

  assertEquals(capturedCompanyId, "1048");
});

Deno.test("missing schedule company id falls back to provider company on retry", async () => {
  let capturedCompanyId: string | null | undefined;

  await processSchedule(
    createDeps({
      getTransaction: async (input) => {
        capturedCompanyId = input.companyId;
        return null;
      },
      createCharge: async () => ({
        success: true,
        transactionState: "PAID",
        chargeId: "417417",
        transactionId: "tx-1",
      }),
    }),
    {
      ...baseSchedule,
      automatic_attempt_count: 2,
      netcred_company_id: null,
    },
  );

  assertEquals(capturedCompanyId, "1048");
});

Deno.test("reconciled PAID without paidAmount commits expected charge amount", async () => {
  let committedAmount: string | undefined;

  const result = await processSchedule(
    createDeps({
      getTransaction: async () => ({
        transactionId: "tx-1",
        referenceCode: "ref-service-1",
        transactionState: "PAID",
        chargeId: "417417",
      }),
      createCharge: async () => {
        throw new Error("should reconcile");
      },
      commitResult: async (input) => {
        committedAmount = input.chargeAmount;
        return input.scheduleId;
      },
      isProduction: false,
    }),
    { ...baseSchedule, automatic_attempt_count: 2, charge_amount: 1024.29 },
  );

  assertEquals(result.outcome, "PAID");
  assertEquals(result.reconciled, true);
  assertEquals(committedAmount, "1024.29");
});

Deno.test("reconciled PAID without paidAmount uses calculateChargeAmount when claim amount missing", async () => {
  let committedAmount: string | undefined;

  const result = await processSchedule(
    createDeps({
      calculateChargeAmount: async () => "1111.11",
      getTransaction: async () => ({
        transactionId: "tx-1",
        referenceCode: "ref-service-1",
        transactionState: "PAID",
        chargeId: "417417",
      }),
      createCharge: async () => {
        throw new Error("should reconcile");
      },
      commitResult: async (input) => {
        committedAmount = input.chargeAmount;
        return input.scheduleId;
      },
      isProduction: false,
    }),
    { ...baseSchedule, automatic_attempt_count: 2, charge_amount: null },
  );

  assertEquals(result.outcome, "PAID");
  assertEquals(result.reconciled, true);
  assertEquals(committedAmount, "1111.11");
});

Deno.test("reconciled PAID with mismatched paidAmount fails closed to IN_ANALYSIS", async () => {
  let committedOutcome: string | undefined;
  let committedAmount: string | undefined;

  const result = await processSchedule(
    createDeps({
      getTransaction: async () => ({
        transactionId: "tx-1",
        referenceCode: "ref-service-1",
        transactionState: "PAID",
        paidAmount: "50.00",
        chargeId: "417417",
      }),
      createCharge: async () => {
        throw new Error("should reconcile");
      },
      commitResult: async (input) => {
        committedOutcome = input.outcome;
        committedAmount = input.chargeAmount;
        return input.scheduleId;
      },
      isProduction: false,
    }),
    { ...baseSchedule, automatic_attempt_count: 2, charge_amount: 1024.29 },
  );

  assertEquals(result.outcome, "IN_ANALYSIS");
  assertEquals(result.reconciled, true);
  assertEquals(committedOutcome, "IN_ANALYSIS");
  assertEquals(committedAmount, "1024.29");
});

Deno.test("reconciled REJECTED without rejectedReason uses default failure message", async () => {
  let failureReason: string | undefined;

  const result = await processSchedule(
    createDeps({
      getTransaction: async () => ({
        transactionId: "tx-rej",
        referenceCode: "ref-service-1",
        transactionState: "REJECTED",
        chargeId: "c-rej",
      }),
      createCharge: async () => {
        throw new Error("should reconcile");
      },
      commitResult: async (input) => {
        failureReason = input.failureReason;
        return input.scheduleId;
      },
    }),
    { ...baseSchedule, automatic_attempt_count: 2 },
  );

  assertEquals(result.outcome, "FAILED_PERMANENT");
  assertEquals(failureReason, "Existing transaction is REJECTED");
});

Deno.test("whitespace schedule company id still pays out via provider company", async () => {
  let captured: CreateChargeInput | undefined;

  await processSchedule(
    createDeps({
      createCharge: async (input) => {
        captured = input;
        return {
          success: true,
          transactionState: "PAID",
          chargeId: "417417",
          transactionId: "tx-1",
        };
      },
      getTransaction: async () => null,
    }),
    {
      ...baseSchedule,
      automatic_attempt_count: 2,
      netcred_company_id: "   ",
    },
  );

  assertEquals(
    captured?.payoutRule.providerAccount.netcredCompanyId,
    "1048",
  );
});

Deno.test("token company mismatch throws PAYMENT_TOKEN_COMPANY_MISMATCH", async () => {
  await assertRejects(
    () =>
      processSchedule(
        createDeps({
          loadPaymentToken: async () => ({
            gateway_payment_profile_id: "403137",
            gateway_card_token: "tok_abc",
            netcred_company_id: "9999",
          }),
        }),
        { ...baseSchedule, automatic_attempt_count: 1 },
      ),
    Error,
    "PAYMENT_TOKEN_COMPANY_MISMATCH",
  );
});

Deno.test("commit uses undefined failureCode when gateway error has no codes", async () => {
  // Covers failureCode = error?.originalCode ?? error?.code when both are missing.
  let failureCode: string | undefined = "sentinel";
  let failureReason: string | undefined;

  const result = await processSchedule(
    createDeps({
      createCharge: async () =>
        ({
          success: false,
          transactionState: "REJECTED",
          error: { message: "gateway declined without code" },
        }) as CreateChargeResult,
      commitResult: async (input) => {
        failureCode = input.failureCode;
        failureReason = input.failureReason;
        return input.scheduleId;
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "FAILED");
  assertEquals(failureCode, undefined);
  assertEquals(failureReason, "gateway declined without code");
});

Deno.test("FAILED_PERMANENT without error codes still emits warning from history only", async () => {
  let warningCodes: string[] | undefined;

  const result = await processSchedule(
    createDeps({
      maxAttempts: 1,
      createCharge: async () =>
        ({
          success: false,
          error: { message: "timeout without classification" },
        }) as CreateChargeResult,
      loadHistoricalFailureCodes: async () => ["NETWORK_ERROR"],
      emitFailedPermanentWarning: (input) => {
        warningCodes = input.failure_codes;
      },
      commitResult: async (input) => input.scheduleId,
    }),
    { ...baseSchedule, automatic_attempt_count: 1 },
  );

  assertEquals(result.outcome, "FAILED_PERMANENT");
  assertEquals(warningCodes, ["NETWORK_ERROR"]);
});

Deno.test("null service_request_title omits serviceTitle on chargeCreate input", async () => {
  let captured: CreateChargeInput | undefined;

  await processSchedule(
    createDeps({
      createCharge: async (input) => {
        captured = input;
        return {
          success: true,
          transactionState: "PAID",
          chargeId: "417417",
          transactionId: "tx-1",
        };
      },
    }),
    { ...baseSchedule, service_request_title: null },
  );

  assertEquals(captured?.serviceTitle, undefined);
});

Deno.test("provider missing bank account id is not credentialed", async () => {
  await assertRejects(
    () =>
      processSchedule(
        createDeps({
          loadProviderAccount: async () => ({
            netcred_company_id: "1048",
            netcred_bank_account_id: null,
            onboarding_status: "ACTIVE",
          }),
        }),
        baseSchedule,
      ),
    Error,
    "PROVIDER_NOT_CREDENTIALED",
  );
});

Deno.test("provider account null is not credentialed", async () => {
  await assertRejects(
    () =>
      processSchedule(
        createDeps({
          loadProviderAccount: async () => null,
        }),
        baseSchedule,
      ),
    Error,
    "PROVIDER_NOT_CREDENTIALED",
  );
});
