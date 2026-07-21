import { assertEquals } from "std/testing/asserts";
import type {
  CreateChargeInput,
  GetTransactionResult,
} from "../../_shared/payment/types.ts";
import {
  executeManualCharge,
  toCreateChargeResultFromExisting,
} from "../executeManualCharge.ts";
import type { ManualChargeSchedule } from "../types.ts";

const baseSchedule: ManualChargeSchedule = {
  id: "schedule-1",
  contracted_service_id: "service-1",
  service_request_id: "sr-1",
  service_request_title: "Serviço",
  client_id: "client-1",
  provider_id: "provider-1",
  gateway_slug: "netcred",
  client_card_token_id: "token-1",
  provider_payout: 850,
  installment_number: 1,
  base_amount: 1000,
  state: "PROCESSING",
  manual_attempt_count: 2,
  automatic_attempt_count: 3,
  max_attempts: 3,
  clearsale_session_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  client_ip_address: "189.0.0.1",
  gateway_reference_code: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
};

const chargeInput: CreateChargeInput = {
  referenceCode: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
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

Deno.test("executeManualCharge reconciles PAID without createCharge or rotate", async () => {
  let createChargeCalled = false;
  let rotateCalled = false;

  const result = await executeManualCharge(
    {
      getTransaction: async () => ({
        transactionId: "tx-paid",
        referenceCode: baseSchedule.gateway_reference_code!,
        transactionState: "PAID",
        paidAmount: "1024.29",
        chargeId: "417417",
      }),
      createCharge: async () => {
        createChargeCalled = true;
        return { success: true, transactionState: "PAID" };
      },
      rotateGatewayReference: async () => {
        rotateCalled = true;
        return "11111111-2222-3333-4444-555555555555";
      },
    },
    baseSchedule,
    "1048",
    chargeInput,
  );

  assertEquals(createChargeCalled, false);
  assertEquals(rotateCalled, false);
  assertEquals(result.kind, "reconciled");
  if (result.kind === "reconciled") {
    assertEquals(result.existing.transactionState, "PAID");
  }
});

Deno.test("executeManualCharge reconciles IN_ANALYSIS without createCharge or rotate", async () => {
  let createChargeCalled = false;
  let rotateCalled = false;

  const result = await executeManualCharge(
    {
      getTransaction: async () => ({
        transactionId: "tx-analysis",
        referenceCode: baseSchedule.gateway_reference_code!,
        transactionState: "IN_ANALYSIS",
        chargeId: "417418",
      }),
      createCharge: async () => {
        createChargeCalled = true;
        return { success: true, transactionState: "PAID" };
      },
      rotateGatewayReference: async () => {
        rotateCalled = true;
        return "11111111-2222-3333-4444-555555555555";
      },
    },
    baseSchedule,
    "1048",
    chargeInput,
  );

  assertEquals(createChargeCalled, false);
  assertEquals(rotateCalled, false);
  assertEquals(result.kind, "reconciled");
});

Deno.test("executeManualCharge rotates then createCharge when prior REJECTED", async () => {
  const rotatedRef = "11111111-2222-3333-4444-555555555555";
  let lookedUpRef: string | undefined;
  let chargedRef: string | undefined;
  let rotateCalled = false;

  const result = await executeManualCharge(
    {
      getTransaction: async (input) => {
        lookedUpRef = input.referenceCode;
        if (input.referenceCode === rotatedRef) {
          return null;
        }
        return {
          transactionId: "tx-rejected",
          referenceCode: input.referenceCode,
          transactionState: "REJECTED",
          rejectedReason: "insufficient funds",
          chargeId: "417400",
        };
      },
      createCharge: async (input) => {
        chargedRef = input.referenceCode;
        return {
          success: true,
          transactionState: "PAID",
          chargeId: "417999",
          transactionId: "tx-new",
        };
      },
      rotateGatewayReference: async () => {
        rotateCalled = true;
        return rotatedRef;
      },
    },
    baseSchedule,
    "1048",
    chargeInput,
  );

  assertEquals(lookedUpRef, baseSchedule.gateway_reference_code);
  assertEquals(rotateCalled, true);
  assertEquals(chargedRef, rotatedRef);
  assertEquals(result.kind, "charged");
});

Deno.test("executeManualCharge rotates then createCharge when prior absent", async () => {
  const rotatedRef = "99999999-8888-7777-6666-555555555555";
  let createChargeCalled = false;
  let rotateCalled = false;

  const result = await executeManualCharge(
    {
      getTransaction: async () => null,
      createCharge: async () => {
        createChargeCalled = true;
        return { success: true, transactionState: "PAID", chargeId: "1" };
      },
      rotateGatewayReference: async () => {
        rotateCalled = true;
        return rotatedRef;
      },
    },
    baseSchedule,
    "1048",
    chargeInput,
  );

  assertEquals(rotateCalled, true);
  assertEquals(createChargeCalled, true);
  assertEquals(result.kind, "charged");
  if (result.kind === "charged") {
    assertEquals(result.referenceCode, rotatedRef);
  }
});

Deno.test("executeManualCharge rotates then createCharge when prior VOIDED", async () => {
  let rotateCalled = false;

  const result = await executeManualCharge(
    {
      getTransaction: async () => ({
        transactionId: "tx-voided",
        referenceCode: baseSchedule.gateway_reference_code!,
        transactionState: "VOIDED",
        chargeId: "417401",
      }),
      createCharge: async () => ({
        success: true,
        transactionState: "PAID",
        chargeId: "417902",
      }),
      rotateGatewayReference: async () => {
        rotateCalled = true;
        return "aaaaaaaa-0000-1111-2222-bbbbbbbbbbbb";
      },
    },
    baseSchedule,
    "1048",
    chargeInput,
  );

  assertEquals(rotateCalled, true);
  assertEquals(result.kind, "charged");
});

Deno.test("executeManualCharge passes companyId to getTransaction", async () => {
  let capturedCompanyId: string | undefined;

  await executeManualCharge(
    {
      getTransaction: async (input) => {
        capturedCompanyId = input.companyId;
        return {
          transactionId: "tx-1",
          referenceCode: input.referenceCode,
          transactionState: "PAID",
          chargeId: "1",
        };
      },
      createCharge: async () => ({ success: true, transactionState: "PAID" }),
      rotateGatewayReference: async () => "new-ref",
    },
    baseSchedule,
    "1048",
    chargeInput,
  );

  assertEquals(capturedCompanyId, "1048");
});

Deno.test("executeManualCharge reconciles REFERENCE_CODE_CONFLICT via getTransaction", async () => {
  const rotatedRef = "conflict-ref-uuid";
  let createCalls = 0;

  const result = await executeManualCharge(
    {
      getTransaction: async (input) => {
        if (input.referenceCode === rotatedRef) {
          return {
            transactionId: "tx-conflict",
            referenceCode: rotatedRef,
            transactionState: "PAID",
            paidAmount: "1024.29",
            chargeId: "417417",
          } satisfies GetTransactionResult;
        }
        return null;
      },
      createCharge: async () => {
        createCalls += 1;
        return {
          success: false,
          error: {
            code: "REFERENCE_CODE_CONFLICT",
            message: "referenceCode already exists",
          },
        };
      },
      rotateGatewayReference: async () => rotatedRef,
    },
    baseSchedule,
    "1048",
    chargeInput,
  );

  assertEquals(createCalls, 1);
  assertEquals(result.kind, "reconciled");
});

Deno.test("toCreateChargeResultFromExisting maps PAID and IN_ANALYSIS", () => {
  assertEquals(
    toCreateChargeResultFromExisting({
      transactionId: "tx-1",
      referenceCode: "ref",
      transactionState: "PAID",
      chargeId: "c1",
    }).transactionState,
    "PAID",
  );

  const analysis = toCreateChargeResultFromExisting({
    transactionId: "tx-2",
    referenceCode: "ref",
    transactionState: "IN_ANALYSIS",
    chargeId: "c2",
  });
  assertEquals(analysis.success, true);
  assertEquals(analysis.transactionState, "IN_ANALYSIS");
});
