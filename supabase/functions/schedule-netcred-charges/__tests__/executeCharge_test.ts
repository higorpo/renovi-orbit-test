import { assertEquals, assertRejects } from "std/testing/asserts";
import { executeCharge, toCreateChargeResult } from "../executeCharge.ts";
import type { CronChargeSchedule } from "../types.ts";
import type { CreateChargeInput, GetTransactionResult } from "../../_shared/payment/types.ts";

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

const chargeInput: CreateChargeInput = {
  referenceCode: "service-1",
  amount: "1024.29",
  paymentMethod: {
    type: "CREDIT_CARD",
    installmentNumber: 1,
    paymentProfileId: "403137",
    paymentToken: "tok",
  },
  payoutRule: {
    providerAccount: {
      netcredCompanyId: "1048",
      netcredBankAccountId: "2053",
    },
    ruleItems: [],
  },
};

Deno.test("executeCharge passes netcred company id to getTransaction", async () => {
  let capturedCompanyId: string | undefined;

  await executeCharge(
    {
      getTransaction: async (input) => {
        capturedCompanyId = input.companyId;
        return null;
      },
      createCharge: async () => ({ success: true, transactionState: "PAID" }),
    },
    baseSchedule,
    chargeInput,
  );

  assertEquals(capturedCompanyId, "1048");
});

Deno.test("executeCharge calls getTransaction before createCharge on retry", async () => {
  let getTransactionCalled = false;
  let createChargeCalled = false;

  await executeCharge(
    {
      getTransaction: async () => {
        getTransactionCalled = true;
        return null;
      },
      createCharge: async () => {
        createChargeCalled = true;
        return { success: true, transactionState: "PAID" };
      },
    },
    baseSchedule,
    chargeInput,
  );

  assertEquals(getTransactionCalled, true);
  assertEquals(createChargeCalled, true);
});

Deno.test("executeCharge reconciles PAID without createCharge on retry", async () => {
  let createChargeCalled = false;

  const result = await executeCharge(
    {
      getTransaction: async () => ({
        transactionId: "tx-1",
        referenceCode: "service-1",
        transactionState: "PAID",
        paidAmount: "1024.29",
        chargeId: "417417",
      }),
      createCharge: async () => {
        createChargeCalled = true;
        return { success: true, transactionState: "PAID" };
      },
    },
    baseSchedule,
    chargeInput,
  );

  assertEquals(createChargeCalled, false);
  assertEquals(result.kind, "reconciled");
});

Deno.test("executeCharge reconciles REFERENCE_CODE_CONFLICT via getTransaction", async () => {
  let createChargeCalls = 0;

  const result = await executeCharge(
    {
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
    },
    { ...baseSchedule, automatic_attempt_count: 1 },
    chargeInput,
  );

  assertEquals(createChargeCalls, 1);
  assertEquals(result.kind, "reconciled");
});

Deno.test("executeCharge skips pre-check getTransaction on first attempt", async () => {
  let getTransactionCalled = false;

  await executeCharge(
    {
      getTransaction: async () => {
        getTransactionCalled = true;
        return null;
      },
      createCharge: async () => ({ success: true, transactionState: "PAID" }),
    },
    { ...baseSchedule, automatic_attempt_count: 1 },
    chargeInput,
  );

  assertEquals(getTransactionCalled, false);
});

Deno.test("toCreateChargeResult maps PAID existing transaction to success", () => {
  const existing: GetTransactionResult = {
    transactionId: "tx-1",
    referenceCode: "service-1",
    transactionState: "PAID",
    paidAmount: "1024.29",
    chargeId: "417417",
  };

  const result = toCreateChargeResult(existing);
  assertEquals(result.success, true);
  assertEquals(result.transactionState, "PAID");
  assertEquals(result.chargeId, "417417");
  assertEquals(result.transactionId, "tx-1");
});

Deno.test("toCreateChargeResult maps IN_ANALYSIS existing transaction to terminal failure", () => {
  const result = toCreateChargeResult({
    transactionId: "tx-1",
    referenceCode: "service-1",
    transactionState: "IN_ANALYSIS",
    chargeId: "417417",
  });

  assertEquals(result.success, false);
  assertEquals(result.transactionState, "IN_ANALYSIS");
  assertEquals(result.error?.code, "TERMINAL");
  assertEquals(result.error?.originalCode, "IN_ANALYSIS");
});

Deno.test("toCreateChargeResult maps VOIDED existing transaction to terminal failure", () => {
  const result = toCreateChargeResult({
    transactionId: "tx-1",
    referenceCode: "service-1",
    transactionState: "VOIDED",
    chargeId: "417417",
  });

  assertEquals(result.success, false);
  assertEquals(result.transactionState, "VOIDED");
  assertEquals(result.error?.code, "TERMINAL");
});

Deno.test("toCreateChargeResult maps REJECTED existing transaction to terminal failure", () => {
  const result = toCreateChargeResult({
    transactionId: "tx-1",
    referenceCode: "service-1",
    transactionState: "REJECTED",
    chargeId: "417417",
  });

  assertEquals(result.success, false);
  assertEquals(result.transactionState, "REJECTED");
  assertEquals(result.error?.code, "TERMINAL");
});

Deno.test("toCreateChargeResult maps unknown existing state to REJECTED terminal", () => {
  const result = toCreateChargeResult({
    transactionId: "tx-1",
    referenceCode: "service-1",
    transactionState: "CANCELLED",
    chargeId: "417417",
  });

  assertEquals(result.success, false);
  assertEquals(result.transactionState, "REJECTED");
  assertEquals(result.error?.originalCode, "CANCELLED");
});

Deno.test("REFERENCE_CODE_CONFLICT with non-terminal existing returns charged result", async () => {
  const result = await executeCharge(
    {
      getTransaction: async () => ({
        transactionId: "tx-conflict",
        referenceCode: "service-1",
        transactionState: "IN_ANALYSIS",
        chargeId: "417417",
      }),
      createCharge: async () => ({
        success: false,
        error: {
          code: "REFERENCE_CODE_CONFLICT",
          message: "referenceCode already exists",
        },
      }),
    },
    { ...baseSchedule, automatic_attempt_count: 1 },
    chargeInput,
  );

  assertEquals(result.kind, "charged");
  if (result.kind === "charged") {
    assertEquals(result.chargeResult.error?.code, "REFERENCE_CODE_CONFLICT");
  }
});

Deno.test("REFERENCE_CODE_CONFLICT reconciles REJECTED existing transaction", async () => {
  const result = await executeCharge(
    {
      getTransaction: async () => ({
        transactionId: "tx-conflict",
        referenceCode: "service-1",
        transactionState: "REJECTED",
        chargeId: "417417",
      }),
      createCharge: async () => ({
        success: false,
        error: {
          code: "REFERENCE_CODE_CONFLICT",
          message: "referenceCode already exists",
        },
      }),
    },
    { ...baseSchedule, automatic_attempt_count: 1 },
    chargeInput,
  );

  assertEquals(result.kind, "reconciled");
  if (result.kind === "reconciled") {
    assertEquals(result.existing.transactionState, "REJECTED");
  }
});

Deno.test("executeCharge reports gatewayLatencyMs from now stub", async () => {
  let tick = 1_000;

  const result = await executeCharge(
    {
      getTransaction: async () => null,
      createCharge: async () => ({ success: true, transactionState: "PAID" }),
      now: () => {
        const value = tick;
        tick += 250;
        return value;
      },
    },
    { ...baseSchedule, automatic_attempt_count: 1 },
    chargeInput,
  );

  assertEquals(result.kind, "charged");
  if (result.kind === "charged") {
    assertEquals(result.gatewayLatencyMs, 250);
  }
});

Deno.test("executeCharge throws when netcred company id is missing on retry lookup", async () => {
  await assertRejects(
    () =>
      executeCharge(
        {
          getTransaction: async () => null,
          createCharge: async () => ({ success: true, transactionState: "PAID" }),
        },
        { ...baseSchedule, netcred_company_id: null },
        chargeInput,
      ),
    Error,
    "NETCRED_COMPANY_ID_REQUIRED",
  );
});
