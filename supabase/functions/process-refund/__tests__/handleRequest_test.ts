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
    markRefundSubmitted: async () => {},
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
  let submitted = false;
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      refundTransaction: async () => ({
        success: false,
        error: { code: "ALREADY_REFUNDED", message: "already refunded" },
      }),
      markRefundSubmitted: async () => {
        submitted = true;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(submitted, true);
});

Deno.test("gateway refund failure returns HTTP 500 with support_url", async () => {
  let failedRecorded = false;
  let submittedMarked = false;

  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      refundTransaction: async () => ({
        success: false,
        error: { code: "UNKNOWN", message: "gateway unavailable" },
      }),
      markRefundSubmitted: async () => {
        submittedMarked = true;
      },
      recordRefundFailed: async () => {
        failedRecorded = true;
      },
    }),
  );

  assertEquals(response.status, 500);
  assertEquals(failedRecorded, true);
  assertEquals(submittedMarked, false);
  const body = await response.json();
  assertEquals(body.support_url, "https://renovi.com.br/suporte");
  assertEquals(body.refund_submit_status, "FAILED");
});

Deno.test("gateway failure then retry invokes refundTransaction again", async () => {
  let gatewayCalls = 0;
  let submitCalls = 0;
  let markedSubmitted = false;

  const deps = createDeps({
    submitRefundRequest: async () => {
      submitCalls += 1;
      // First begin → PENDING_GATEWAY; after fail, retry still already_submitted=false.
      return {
        scheduleId: "schedule-1",
        providerTransactionId: "tx-1",
        paidAmount: "1024.29",
        baseAmount: "1000.00",
        refundAmount: "1000.00",
        penaltyTier: "FULL_REFUND",
        alreadySubmitted: false,
        refundSubmitStatus: submitCalls === 1 ? "PENDING_GATEWAY" : "PENDING_GATEWAY",
      };
    },
    refundTransaction: async () => {
      gatewayCalls += 1;
      if (gatewayCalls === 1) {
        return {
          success: false,
          error: { code: "UNKNOWN", message: "gateway unavailable" },
        };
      }
      return { success: true };
    },
    markRefundSubmitted: async () => {
      markedSubmitted = true;
    },
  });

  const first = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    deps,
  );
  assertEquals(first.status, 500);
  assertEquals(gatewayCalls, 1);
  assertEquals(markedSubmitted, false);

  const second = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    deps,
  );
  assertEquals(second.status, 200);
  assertEquals(gatewayCalls, 2);
  assertEquals(markedSubmitted, true);
  const body = await second.json();
  assertEquals(body.refund_submit_status, "SUBMITTED");
});

Deno.test("pre-charge SCHEDULED cancel returns PRE_CHARGE_CANCELLED", async () => {
  let preChargeCalled = false;

  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1", cancellation_reason: "changed plans" }),
    createDeps({
      loadRefundContext: async () => ({
        ...paidContext,
        scheduleState: "SCHEDULED",
        paidAmount: null,
        providerTransactionId: null,
      }),
      preChargeCancel: async (input) => {
        preChargeCalled = true;
        assertEquals(input.initiator, "client");
        assertEquals(input.cancellationReason, "changed plans");
        return "schedule-1";
      },
      submitRefundRequest: async () => {
        throw new Error("submitRefundRequest should not run for pre-charge");
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(preChargeCalled, true);
  const body = await response.json();
  assertEquals(body.outcome, "PRE_CHARGE_CANCELLED");
  assertEquals(body.schedule_id, "schedule-1");
});

Deno.test("wrong initiator returns HTTP 403 FORBIDDEN", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      getUser: async () => ({ user: { id: "stranger-1" }, error: null }),
    }),
  );

  assertEquals(response.status, 403);
  const body = await response.json();
  assertEquals(body.error_code, "FORBIDDEN");
});

Deno.test("already_submitted refund returns idempotent HTTP 200", async () => {
  let refundCalled = false;

  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      submitRefundRequest: async () => ({
        scheduleId: "schedule-1",
        providerTransactionId: "tx-1",
        paidAmount: "1024.29",
        baseAmount: "1000.00",
        refundAmount: "1000.00",
        penaltyTier: "FULL_REFUND",
        alreadySubmitted: true,
      }),
      refundTransaction: async () => {
        refundCalled = true;
        return { success: true };
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(refundCalled, false);
  const body = await response.json();
  assertEquals(body.already_submitted, true);
  assertEquals(body.schedule_id, "schedule-1");
  assertEquals(body.expected_days, "30-60");
});

Deno.test("COMPLETED service returns HTTP 409 SERVICE_NOT_CANCELLABLE", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      loadRefundContext: async () => ({
        ...paidContext,
        status: "COMPLETED",
      }),
    }),
  );

  assertEquals(response.status, 409);
  const body = await response.json();
  assertEquals(body.error_code, "SERVICE_NOT_CANCELLABLE");
});

Deno.test("PAID without service_scheduled_at returns HTTP 422", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      loadRefundContext: async () => ({
        ...paidContext,
        serviceScheduledAt: null,
      }),
    }),
  );

  assertEquals(response.status, 422);
  const body = await response.json();
  assertEquals(body.error, "service_scheduled_at_missing");
});

Deno.test("pre-charge cancel RPC error maps status from error code", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      loadRefundContext: async () => ({
        ...paidContext,
        scheduleState: "FAILED",
      }),
      preChargeCancel: async () => "FORBIDDEN",
    }),
  );

  assertEquals(response.status, 403);
  const body = await response.json();
  assertEquals(body.error_code, "FORBIDDEN");
});

Deno.test("OPTIONS returns 204", async () => {
  const response = await handleProcessRefundRequest(
    new Request("https://example.com/process-refund", { method: "OPTIONS" }),
    createDeps(),
  );
  assertEquals(response.status, 204);
});

Deno.test("non-POST returns 405", async () => {
  const response = await handleProcessRefundRequest(
    new Request("https://example.com/process-refund", { method: "GET" }),
    createDeps(),
  );
  assertEquals(response.status, 405);
});

Deno.test("missing Authorization returns 401", async () => {
  const response = await handleProcessRefundRequest(
    new Request("https://example.com/process-refund", {
      method: "POST",
      body: JSON.stringify({ service_id: "service-1" }),
    }),
    createDeps(),
  );
  assertEquals(response.status, 401);
});

Deno.test("getUser failure returns 401", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      getUser: async () => ({ user: null, error: new Error("bad token") }),
    }),
  );
  assertEquals(response.status, 401);
});

Deno.test("rate limit returns 429", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      checkRateLimit: async () => ({ allowed: false, retryAfter: 30 }),
    }),
  );
  assertEquals(response.status, 429);
  assertEquals(response.headers.get("Retry-After"), "30");
});

Deno.test("invalid JSON body returns 400", async () => {
  const response = await handleProcessRefundRequest(
    new Request("https://example.com/process-refund", {
      method: "POST",
      headers: { Authorization: "Bearer jwt-token" },
      body: "{",
    }),
    createDeps(),
  );
  assertEquals(response.status, 400);
});

Deno.test("missing service_id returns 400", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({}),
    createDeps(),
  );
  assertEquals(response.status, 400);
});

Deno.test("unknown service returns 404 SERVICE_NOT_FOUND", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "missing" }),
    createDeps({ loadRefundContext: async () => null }),
  );
  assertEquals(response.status, 404);
  const body = await response.json();
  assertEquals(body.error_code, "SERVICE_NOT_FOUND");
});

Deno.test("provider initiator can cancel paid service", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      getUser: async () => ({ user: { id: "provider-1" }, error: null }),
    }),
  );
  assertEquals(response.status, 200);
});

Deno.test("INVALID_SCHEDULE_STATE for unexpected schedule state", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      loadRefundContext: async () => ({
        ...paidContext,
        scheduleState: "PROCESSING",
      }),
    }),
  );
  assertEquals(response.status, 409);
  const body = await response.json();
  assertEquals(body.error_code, "INVALID_SCHEDULE_STATE");
});

Deno.test("submitRefundRequest error maps SERVICE_NOT_FOUND to 404", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      submitRefundRequest: async () => "SERVICE_NOT_FOUND",
    }),
  );
  assertEquals(response.status, 404);
});

Deno.test("mapRpcErrorCode extracts known codes from messages", async () => {
  const { mapRpcErrorCode } = await import("../handleRequest.ts");
  assertEquals(mapRpcErrorCode("error: FORBIDDEN"), "FORBIDDEN");
  assertEquals(mapRpcErrorCode("SCHEDULE_NOT_FOUND in rpc"), "SCHEDULE_NOT_FOUND");
  assertEquals(mapRpcErrorCode("PAYMENT_SCHEDULE_TERMINAL_STATE"), "PAYMENT_SCHEDULE_TERMINAL_STATE");
  assertEquals(mapRpcErrorCode("PAYMENT_SCHEDULE_INVALID_TRANSITION"), "PAYMENT_SCHEDULE_INVALID_TRANSITION");
  assertEquals(mapRpcErrorCode("unknown boom"), null);
});

Deno.test("refund failure without error object uses UNKNOWN code", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      refundTransaction: async () => ({ success: false }),
    }),
  );
  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.error_code, "UNKNOWN");
});

Deno.test("REFUND_REQUESTED allows idempotent resubmit without re-calling gateway when already_submitted", async () => {
  let refundCalled = false;

  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      loadRefundContext: async () => ({
        ...paidContext,
        scheduleState: "REFUND_REQUESTED",
      }),
      submitRefundRequest: async () => ({
        scheduleId: "schedule-1",
        providerTransactionId: "tx-1",
        paidAmount: "1024.29",
        baseAmount: "1000.00",
        refundAmount: "1000.00",
        penaltyTier: "FULL_REFUND",
        alreadySubmitted: true,
      }),
      refundTransaction: async () => {
        refundCalled = true;
        return { success: true };
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(refundCalled, false);
  const body = await response.json();
  assertEquals(body.already_submitted, true);
});

Deno.test("paid refund passes NetCred transactionId and amount to refundTransaction", async () => {
  let refundInput: {
    transactionId: string;
    amount: string;
    referenceCode?: string;
  } | undefined;

  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      submitRefundRequest: async () => ({
        scheduleId: "schedule-1",
        providerTransactionId: "262273",
        paidAmount: "1024.29",
        baseAmount: "1000.00",
        refundAmount: "900.00",
        penaltyTier: "PENALTY_10",
        alreadySubmitted: false,
      }),
      refundTransaction: async (input) => {
        refundInput = input;
        return { success: true };
      },
    }),
  );

  assertEquals(response.status, 200);
  // NetCred transactionRefund requires transaction.id (not charge.id).
  assertEquals(refundInput?.transactionId, "262273");
  assertEquals(refundInput?.amount, "900.00");
  assertEquals(refundInput?.referenceCode, "service-1");
  const body = await response.json();
  assertEquals(body.penalty_tier, "PENALTY_10");
  assertEquals(body.refund_amount, "900.00");
  assertEquals(body.expected_days, "30-60");
});

Deno.test("submitRefundRequest TRANSACTION_NOT_FOUND maps to HTTP 409", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      submitRefundRequest: async () => "TRANSACTION_NOT_FOUND",
    }),
  );

  assertEquals(response.status, 409);
  const body = await response.json();
  assertEquals(body.error_code, "TRANSACTION_NOT_FOUND");
});

Deno.test("pre-charge FAILED_PERMANENT cancel succeeds without gateway refund", async () => {
  let refundCalled = false;
  let submitCalled = false;

  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      loadRefundContext: async () => ({
        ...paidContext,
        scheduleState: "FAILED_PERMANENT",
        paidAmount: null,
        providerTransactionId: null,
      }),
      preChargeCancel: async () => "schedule-1",
      submitRefundRequest: async () => {
        submitCalled = true;
        return "INVALID_SCHEDULE_STATE";
      },
      refundTransaction: async () => {
        refundCalled = true;
        return { success: true };
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(submitCalled, false);
  assertEquals(refundCalled, false);
  const body = await response.json();
  assertEquals(body.outcome, "PRE_CHARGE_CANCELLED");
});

Deno.test("pre-charge SERVICE_NOT_CANCELLABLE maps to HTTP 409 via default status", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      loadRefundContext: async () => ({
        ...paidContext,
        scheduleState: "SCHEDULED",
      }),
      preChargeCancel: async () => "SERVICE_NOT_CANCELLABLE",
    }),
  );

  assertEquals(response.status, 409);
  const body = await response.json();
  assertEquals(body.error_code, "SERVICE_NOT_CANCELLABLE");
});

Deno.test("provider full refund still returns expected_days for invoice timing", async () => {
  const response = await handleProcessRefundRequest(
    authRequest({ service_id: "service-1" }),
    createDeps({
      getUser: async () => ({ user: { id: "provider-1" }, error: null }),
      submitRefundRequest: async (input) => {
        assertEquals(input.initiator, "provider");
        return {
          scheduleId: "schedule-1",
          providerTransactionId: "tx-1",
          paidAmount: "1024.29",
          baseAmount: "1000.00",
          refundAmount: "1024.29",
          penaltyTier: "FULL_REFUND",
          alreadySubmitted: false,
        };
      },
    }),
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.refund_amount, "1024.29");
  assertEquals(body.expected_days, "30-60");
});
