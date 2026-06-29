import { assertEquals } from "std/testing/asserts";
import {
  handleProcessRefundRequest,
  type ProcessRefundDeps,
} from "../handleRequest.ts";
import type { RefundContext } from "../types.ts";

const paidContext: RefundContext = {
  serviceId: "service-1",
  clientId: "client-1",
  providerId: "provider-1",
  status: "CONFIRMED",
  serviceScheduledAt: "2026-07-04T11:00:00.000Z",
  scheduleId: "schedule-1",
  scheduleState: "PAID",
  baseAmount: 1000,
  paidAmount: 1024.29,
  providerTransactionId: "tx-1",
};

function createDeps(overrides: Partial<ProcessRefundDeps> = {}): ProcessRefundDeps {
  return {
    getUser: async () => ({ user: { id: "client-1" }, error: null }),
    loadRefundContext: async () => ({ ...paidContext }),
    preChargeCancel: async () => "schedule-1",
    submitRefundRequest: async () => ({
      scheduleId: "schedule-1",
      providerTransactionId: "tx-1",
      paidAmount: "1024.29",
      baseAmount: "1000.00",
      refundAmount: "1000.00",
      penaltyTier: "FULL_REFUND",
      alreadySubmitted: false,
    }),
    refundTransaction: async () => ({ success: true }),
    recordRefundFailed: async () => {},
    captureCriticalError: () => {},
    getSupportUrl: () => "https://renovi.com.br/suporte",
    checkRateLimit: async () => ({ allowed: true, retryAfter: 0 }),
    now: () => new Date("2026-07-01T10:00:00.000Z"),
    ...overrides,
  };
}

function authRequest(body: Record<string, unknown>): Request {
  return new Request("https://example.com/process-refund", {
    method: "POST",
    headers: {
      Authorization: "Bearer jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

Deno.test("IN_ANALYSIS state returns HTTP 409 PAYMENT_IN_ANALYSIS", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      loadRefundContext: async () => ({
        ...paidContext,
        scheduleState: "IN_ANALYSIS",
      }),
    }),
  );

  assertEquals(response.status, 409);
  const body = await response.json();
  assertEquals(body.error_code, "PAYMENT_IN_ANALYSIS");
});

Deno.test("paid cancellation returns refund amount and expected_days", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps(),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.refund_amount, "1000.00");
  assertEquals(body.penalty_tier, "FULL_REFUND");
  assertEquals(body.expected_days, "30-60");
});

Deno.test("ALREADY_REFUNDED gateway response is treated as success", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      refundTransaction: async () => ({
        success: false,
        error: { code: "ALREADY_REFUNDED", message: "already refunded" },
      }),
    }),
  );

  assertEquals(response.status, 200);
});

Deno.test("gateway refund failure returns HTTP 500 with support_url", async () => {
  let failedRecorded = false;

  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      refundTransaction: async () => ({
        success: false,
        error: { code: "UNKNOWN", message: "gateway unavailable" },
      }),
      recordRefundFailed: async () => {
        failedRecorded = true;
      },
    }),
  );

  assertEquals(response.status, 500);
  assertEquals(failedRecorded, true);
  const body = await response.json();
  assertEquals(body.support_url, "https://renovi.com.br/suporte");
});
