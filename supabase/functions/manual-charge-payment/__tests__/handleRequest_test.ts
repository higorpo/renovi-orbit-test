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
};

function createDeps(overrides: Partial<ManualChargePaymentDeps> = {}): ManualChargePaymentDeps {
  return {
    getUser: async () => ({ user: { id: "client-1" }, error: null }),
    acquireLease: async () => ({
      schedule: {
        ...baseSchedule,
        clearsale_session_id: "fresh-clearsale-uuid",
      },
    }),
    calculateChargeAmount: async () => "1024.29",
    loadPaymentToken: async () => ({
      id: "token-1",
      gateway_payment_profile_id: "403137",
      gateway_card_token: "tok",
      state: "ACTIVE",
    }),
    loadProviderAccount: async () => ({
      provider_id: "provider-1",
      netcred_company_id: "1048",
      netcred_bank_account_id: "2053",
      onboarding_status: "ACTIVE",
    }),
    createCharge: async () => ({
      success: true,
      transactionState: "PAID",
      chargeId: "417417",
      transactionId: "tx-1",
    }),
    commitResult: async () => "schedule-1",
    ingestNotification: async () => {},
    checkRateLimit: async () => ({ allowed: true, retryAfter: 0 }),
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
      clearsale_session_id: "fresh-clearsale-uuid",
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
      clearsale_session_id: "fresh-clearsale-uuid",
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
      clearsale_session_id: "fresh-clearsale-uuid",
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
      clearsale_session_id: "fresh-clearsale-uuid",
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
  const freshSessionId = "11111111-2222-3333-4444-555555555555";
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
