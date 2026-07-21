import { assertEquals } from "std/testing/asserts";
import type { CreateChargeInput, CreateChargeResult } from "../../_shared/payment/types.ts";
import {
  handleManualChargePaymentRequest,
  type ManualChargePaymentDeps,
} from "../handleRequest.ts";
import type { ManualChargeSchedule } from "../types.ts";

const baseSchedule: ManualChargeSchedule = {
  id: "schedule-1",
  contracted_service_id: "service-1",
  service_request_id: "sr-1",
  client_id: "client-1",
  provider_id: "provider-1",
  gateway_slug: "netcred",
  client_card_token_id: "token-1",
  provider_payout: 850,
  installment_number: 1,
  base_amount: 1000,
  state: "PROCESSING",
  manual_attempt_count: 1,
  automatic_attempt_count: 3,
  max_attempts: 3,
  clearsale_session_id: null,
  client_ip_address: "189.0.0.1",
  gateway_reference_code: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
};

function createDeps(overrides: Partial<ManualChargePaymentDeps> = {}): ManualChargePaymentDeps {
  return {
    getUser: async () => ({ user: { id: "client-1" }, error: null }),
    acquireLease: async () => ({
      schedule: {
        ...baseSchedule,
        clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    }),
    calculateChargeAmount: async () => "1024.29",
    loadPaymentToken: async () => ({
      id: "token-1",
      gateway_payment_profile_id: "403137",
      gateway_card_token: "tok",
      state: "ACTIVE",
      netcred_company_id: "1014",
    }),
    loadProviderAccount: async () => ({
      provider_id: "provider-1",
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
    rotateGatewayReference: async () => "11111111-2222-3333-4444-555555555555",
    commitResult: async () => "schedule-1",
    enqueueNotification: async () => {},
    checkRateLimit: async () => ({ allowed: true, retryAfter: 0 }),
    platformCompanyId: "1014",
    ...overrides,
  };
}

function authRequest(body: Record<string, unknown>): Request {
  return new Request("https://example.com/manual-charge-payment", {
    method: "POST",
    headers: {
      Authorization: "Bearer jwt-token",
      "Content-Type": "application/json",
      "CF-Connecting-IP": "189.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

Deno.test("EF rate limit exceeded returns HTTP 429 with Retry-After", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      checkRateLimit: async () => ({
        allowed: false,
        remaining: 0,
        retryAfter: 45,
      }),
    }),
  );

  assertEquals(response.status, 429);
  assertEquals(response.headers.get("Retry-After"), "45");
  const body = await response.json();
  assertEquals(body.error, "rate_limited");
});

Deno.test("RPC rate limit exceeded returns HTTP 429 RATE_LIMIT_EXCEEDED", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      acquireLease: async () => ({ error: "RATE_LIMIT_EXCEEDED" }),
    }),
  );

  assertEquals(response.status, 429);
  const body = await response.json();
  assertEquals(body.error_code, "RATE_LIMIT_EXCEEDED");
});

Deno.test("T-12h gate returns HTTP 409 SERVICE_AUTO_CANCELLED", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      acquireLease: async () => ({ error: "SERVICE_AUTO_CANCELLED" }),
    }),
  );

  assertEquals(response.status, 409);
  const body = await response.json();
  assertEquals(body.error_code, "SERVICE_AUTO_CANCELLED");
});

Deno.test("concurrent cron lock returns HTTP 409 PAYMENT_ALREADY_IN_PROGRESS", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      acquireLease: async () => ({ error: "PAYMENT_ALREADY_IN_PROGRESS" }),
    }),
  );

  assertEquals(response.status, 409);
  const body = await response.json();
  assertEquals(body.error_code, "PAYMENT_ALREADY_IN_PROGRESS");
});

Deno.test("fresh clearsale_session_id is persisted before charge", async () => {
  const freshSessionId = "11111111-2222-4333-8444-555555555555";
  let persistedSessionId: string | null = null;
  let chargeSessionId: string | undefined;

  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: freshSessionId,
    }),
    createDeps({
      acquireLease: async (input) => {
        persistedSessionId = input.clearsaleSessionId;
        return {
          schedule: {
            ...baseSchedule,
            clearsale_session_id: input.clearsaleSessionId,
            client_ip_address: input.clientIpAddress,
          },
        };
      },
      createCharge: async (input: CreateChargeInput): Promise<CreateChargeResult> => {
        chargeSessionId = input.sessionId;
        return {
          success: true,
          transactionState: "PAID",
          chargeId: "417417",
          transactionId: "tx-1",
        };
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(persistedSessionId, freshSessionId);
  assertEquals(chargeSessionId, freshSessionId);
});

Deno.test("manual charge uses rotated gateway_reference_code after absent prior", async () => {
  let referenceCode: string | undefined;
  const priorReference = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const rotatedReference = "11111111-2222-3333-4444-555555555555";

  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      acquireLease: async () => ({
        schedule: {
          ...baseSchedule,
          contracted_service_id: "be2fed77-cedd-4f34-bd07-14693e763298",
          manual_attempt_count: 5,
          gateway_reference_code: priorReference,
          clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
      }),
      getTransaction: async () => null,
      rotateGatewayReference: async () => rotatedReference,
      createCharge: async (input: CreateChargeInput): Promise<CreateChargeResult> => {
        referenceCode = input.referenceCode;
        return {
          success: true,
          transactionState: "PAID",
          chargeId: "417999",
          transactionId: "tx-new",
        };
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(referenceCode, rotatedReference);
});

Deno.test(
  "PAID under old ref + FAILED_PERMANENT lease returns PAID without second createCharge",
  async () => {
    const priorReference = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    let createChargeCalls = 0;
    let rotateCalls = 0;
    let committedOutcome: string | undefined;
    let lookedUpRef: string | undefined;
    let lookedUpCompanyId: string | undefined;

    const response = await handleManualChargePaymentRequest(
      authRequest({
        schedule_id: "schedule-1",
        clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
      createDeps({
        acquireLease: async () => ({
          schedule: {
            ...baseSchedule,
            state: "PROCESSING",
            manual_attempt_count: 2,
            gateway_reference_code: priorReference,
            clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          },
        }),
        getTransaction: async (input) => {
          lookedUpRef = input.referenceCode;
          lookedUpCompanyId = input.companyId;
          return {
            transactionId: "tx-prior-paid",
            referenceCode: priorReference,
            transactionState: "PAID",
            paidAmount: "1024.29",
            chargeId: "417417",
          };
        },
        rotateGatewayReference: async () => {
          rotateCalls += 1;
          return "should-not-rotate";
        },
        createCharge: async () => {
          createChargeCalls += 1;
          return {
            success: true,
            transactionState: "PAID",
            chargeId: "second-charge",
            transactionId: "tx-second",
          };
        },
        commitResult: async (input) => {
          committedOutcome = input.outcome;
          return "schedule-1";
        },
      }),
    );

    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.outcome, "PAID");
    assertEquals(lookedUpRef, priorReference);
    assertEquals(lookedUpCompanyId, "1048");
    assertEquals(createChargeCalls, 0);
    assertEquals(rotateCalls, 0);
    assertEquals(committedOutcome, "PAID");
  },
);
Deno.test("OPTIONS returns 204 and non-POST returns 405", async () => {
  const options = await handleManualChargePaymentRequest(
    new Request("https://example.com/manual-charge-payment", { method: "OPTIONS" }),
    createDeps(),
  );
  assertEquals(options.status, 204);

  const get = await handleManualChargePaymentRequest(
    new Request("https://example.com/manual-charge-payment", { method: "GET" }),
    createDeps(),
  );
  assertEquals(get.status, 405);
});

Deno.test("missing Authorization returns HTTP 401", async () => {
  const response = await handleManualChargePaymentRequest(
    new Request("https://example.com/manual-charge-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schedule_id: "schedule-1",
        clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    }),
    createDeps(),
  );

  assertEquals(response.status, 401);
});

Deno.test("missing schedule_id returns HTTP 400", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({ clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
    createDeps(),
  );

  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error, "schedule_id is required");
});

Deno.test("missing clearsale_session_id returns HTTP 400", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({ schedule_id: "schedule-1" }),
    createDeps(),
  );

  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error_code, "CLEARSALE_SESSION_REQUIRED");
});

Deno.test("non-UUID clearsale_session_id returns HTTP 400 CLEARSALE_SESSION_INVALID", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "not-a-uuid",
    }),
    createDeps(),
  );

  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error_code, "CLEARSALE_SESSION_INVALID");
});

Deno.test("SCHEDULE_NOT_FOUND acquire error returns HTTP 404", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "missing",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      acquireLease: async () => ({ error: "SCHEDULE_NOT_FOUND" }),
    }),
  );

  assertEquals(response.status, 404);
  const body = await response.json();
  assertEquals(body.error_code, "SCHEDULE_NOT_FOUND");
});

Deno.test("missing client_card_token_id returns PAYMENT_TOKEN_MISSING", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      acquireLease: async () => ({
        schedule: {
          ...baseSchedule,
          client_card_token_id: null,
          clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
      }),
    }),
  );

  assertEquals(response.status, 422);
  const body = await response.json();
  assertEquals(body.error_code, "PAYMENT_TOKEN_MISSING");
});

Deno.test("inactive payment token returns PAYMENT_TOKEN_INACTIVE", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      loadPaymentToken: async () => ({
        id: "token-1",
        gateway_payment_profile_id: "403137",
        gateway_card_token: "tok",
        state: "INACTIVE",
        netcred_company_id: "1014",
      }),
    }),
  );

  assertEquals(response.status, 422);
  const body = await response.json();
  assertEquals(body.error_code, "PAYMENT_TOKEN_INACTIVE");
});

Deno.test("provider not credentialed returns PROVIDER_NOT_CREDENTIALED", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      loadProviderAccount: async () => ({
        provider_id: "provider-1",
        netcred_company_id: null,
        netcred_bank_account_id: null,
        onboarding_status: "PENDING",
      }),
    }),
  );

  assertEquals(response.status, 422);
  const body = await response.json();
  assertEquals(body.error_code, "PROVIDER_NOT_CREDENTIALED");
});

Deno.test("token company mismatch returns PAYMENT_TOKEN_COMPANY_MISMATCH", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      loadPaymentToken: async () => ({
        id: "token-1",
        gateway_payment_profile_id: "403137",
        gateway_card_token: "tok",
        state: "ACTIVE",
        netcred_company_id: "9999",
      }),
    }),
  );

  assertEquals(response.status, 422);
  const body = await response.json();
  assertEquals(body.error_code, "PAYMENT_TOKEN_COMPANY_MISMATCH");
});

Deno.test("charge amount calculation failure returns HTTP 500", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      calculateChargeAmount: async () => null,
    }),
  );

  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.error, "charge_amount_calculation_failed");
});

Deno.test("commit failure returns HTTP 500", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      commitResult: async () => null,
    }),
  );

  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.error, "manual_charge_commit_failed");
});

Deno.test("notification enqueue failure does not fail the charge response", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      enqueueNotification: async () => {
        throw new Error("queue down");
      },
    }),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.outcome, "PAID");
});

Deno.test("FAILED charge outcome still returns HTTP 200 with outcome", async () => {
  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      createCharge: async () => ({
        success: false,
        error: { code: "RETRYABLE", message: "issuer unavailable" },
      }),
    }),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.outcome, "FAILED");
  assertEquals(body.failure_code, "RETRYABLE");
});

Deno.test("client failure_code uses coarse RISK_REJECTED not fine RISK_ANALYSIS matrix", async () => {
  let committedFailureCode: string | null | undefined;

  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      createCharge: async () => ({
        success: false,
        error: {
          code: "TERMINAL",
          message: "risk analysis",
          originalCode: "RISK_ANALYSIS_FRAUD_SUSPICION",
        },
      }),
      commitResult: async (input) => {
        committedFailureCode = input.failureCode;
        return input.scheduleId;
      },
    }),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.outcome, "FAILED_PERMANENT");
  assertEquals(body.failure_code, "RISK_REJECTED");
  assertEquals(JSON.stringify(body).includes("RISK_ANALYSIS_"), false);
  // Fine code still persisted for ops/audit.
  assertEquals(committedFailureCode, "RISK_ANALYSIS_FRAUD_SUSPICION");
});

Deno.test("client failure_code TERMINAL does not leak REJECTED originalCode", async () => {
  let committedFailureCode: string | null | undefined;

  const response = await handleManualChargePaymentRequest(
    authRequest({
      schedule_id: "schedule-1",
      clearsale_session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    createDeps({
      createCharge: async () => ({
        success: false,
        error: {
          code: "TERMINAL",
          message: "card declined",
          originalCode: "REJECTED",
        },
      }),
      commitResult: async (input) => {
        committedFailureCode = input.failureCode;
        return input.scheduleId;
      },
    }),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.failure_code, "TERMINAL");
  assertEquals(body.failure_code, "TERMINAL");
  assertEquals(committedFailureCode, "REJECTED");
});
