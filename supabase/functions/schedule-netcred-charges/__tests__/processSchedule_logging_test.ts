import { assertEquals, assertRejects } from "std/testing/asserts";
import {
  buildProviderResponseSummary,
  chargeResultLogFields,
} from "../chargeAttemptLogging.ts";
import { processSchedule, type ProcessScheduleDeps } from "../processSchedule.ts";
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
  automatic_attempt_count: 2,
  max_attempts: 3,
  clearsale_session_id: "session-1",
  client_ip_address: "189.0.0.1",
};

function buildDeps(
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
      success: false,
      error: {
        code: "RETRYABLE",
        message: "Invalid bank account id",
        originalCode: "BANK_ACCOUNT_INVALID",
      },
    }),
    commitResult: async () => "schedule-1",
    loadHistoricalFailureCodes: async () => [],
    emitFailedPermanentWarning: () => {},
    ingestNotification: async () => {},
    maxAttempts: 3,
    ...overrides,
  };
}

Deno.test("chargeResultLogFields exposes NetCred message and codes", () => {
  assertEquals(chargeResultLogFields({
    success: false,
    error: {
      code: "RETRYABLE",
      message: "Split rule invalid",
      originalCode: "PAYOUT_RULE_INVALID",
    },
  }), {
    failure_code: "PAYOUT_RULE_INVALID",
    failure_reason: "Split rule invalid",
    gateway_error_class: "RETRYABLE",
    transaction_state: null,
  });
});

Deno.test("chargeResultLogFields returns empty object for success or missing result", () => {
  assertEquals(chargeResultLogFields(undefined), {});
  assertEquals(
    chargeResultLogFields({ success: true, transactionState: "PAID" }),
    {},
  );
});

Deno.test("chargeResultLogFields falls back to error.code when originalCode is absent", () => {
  assertEquals(
    chargeResultLogFields({
      success: false,
      transactionState: "REJECTED",
      error: { code: "TERMINAL", message: "declined" },
    }),
    {
      failure_code: "TERMINAL",
      failure_reason: "declined",
      gateway_error_class: "TERMINAL",
      transaction_state: "REJECTED",
    },
  );
});

Deno.test("chargeResultLogFields uses nulls when failure has no error object", () => {
  assertEquals(
    chargeResultLogFields({
      success: false,
      transactionState: "REJECTED",
    }),
    {
      failure_code: null,
      failure_reason: null,
      gateway_error_class: null,
      transaction_state: "REJECTED",
    },
  );
});

Deno.test("buildProviderResponseSummary persists gateway error message", () => {
  assertEquals(buildProviderResponseSummary({
    success: false,
    error: {
      code: "RETRYABLE",
      message: "Invalid bank account id",
      originalCode: "BANK_ACCOUNT_INVALID",
    },
  }).errorMessage, "Invalid bank account id");
});

Deno.test("processSchedule propagates commit RPC failure after gateway rejection", async () => {
  let capturedFailureReason: string | undefined;

  await assertRejects(
    () =>
      processSchedule(
        buildDeps({
          commitResult: async (input) => {
            capturedFailureReason = input.failureReason;
            throw new Error(
              "payment_commit_charge_outcome failed: INVALID_SCHEDULE_STATE (code=P0001)",
            );
          },
        }),
        baseSchedule,
      ),
    Error,
    "payment_commit_charge_outcome failed: INVALID_SCHEDULE_STATE (code=P0001)",
  );

  assertEquals(capturedFailureReason, "Invalid bank account id");
});

Deno.test("processSchedule commits gateway failure reason on retry", async () => {
  let capturedFailureReason: string | undefined;

  const result = await processSchedule(
    buildDeps({
      commitResult: async (input) => {
        capturedFailureReason = input.failureReason;
        return input.scheduleId;
      },
    }),
    baseSchedule,
  );

  assertEquals(result.outcome, "FAILED");
  assertEquals(capturedFailureReason, "Invalid bank account id");
});
