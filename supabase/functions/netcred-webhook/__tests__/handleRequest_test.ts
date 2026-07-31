import { assertEquals } from "std/testing/asserts";
import { computeHMACSHA256 } from "../../_shared/crypto/hmac.ts";
import {
  buildSummary,
  handleNetcredWebhookRequest,
  type NetcredWebhookDeps,
} from "../handleRequest.ts";
import { validateNetcredWebhookSignature } from "../validateSignature.ts";

function createDeps(
  overrides: Partial<NetcredWebhookDeps> = {},
): NetcredWebhookDeps {
  return {
    getWebhookSecret: async () => "test-webhook-secret",
    persistWebhookEvent: async () => ({
      status: "inserted",
      eventId: "event-1",
    }),
    markDuplicate: async () => {},
    markFailed: async () => {},
    markValidating: async () => {},
    processWebhookEvent: async () => ({ outcome: "processed" }),
    enqueueHeavyProcessing: async () => {},
    emitInvalidSignatureWarning: () => {},
    checkIPRateLimit: async () => ({
      allowed: true,
      remaining: 10,
      retryAfter: 0,
    }),
    emitIPRateLimitWarning: async () => {},
    ...overrides,
  };
}

function webhookRequest(
  rawBody: string,
  options: {
    eventType?: string;
    signature?: string;
  } = {},
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.eventType) {
    headers["X-NETCRED-Event"] = options.eventType;
  }

  if (options.signature) {
    headers["X-NETCRED-Signature"] = options.signature;
  }

  return new Request("https://example.com/netcred-webhook", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

Deno.test("HMAC is computed from raw body before JSON re-serialization", async () => {
  const rawBody = '{"id":"evt-1","amount":100.5}';
  const secret = "test-webhook-secret";
  const signature = await computeHMACSHA256(secret, rawBody);

  const tamperedBody = '{"id":"evt-1","amount":100.50}';
  const valid = await validateNetcredWebhookSignature(rawBody, signature, secret);
  const invalid = await validateNetcredWebhookSignature(
    tamperedBody,
    signature,
    secret,
  );

  assertEquals(valid, true);
  assertEquals(invalid, false);
});

Deno.test("rate limit exceeded returns 429 with Retry-After", async () => {
  let rateLimitWarningEmitted = false;

  const response = await handleNetcredWebhookRequest(
    webhookRequest('{"id":"evt-1"}', { eventType: "WEBHOOK_PING" }),
    createDeps({
      checkIPRateLimit: async () => ({
        allowed: false,
        remaining: 0,
        retryAfter: 30,
      }),
      emitIPRateLimitWarning: async () => {
        rateLimitWarningEmitted = true;
      },
    }),
  );

  assertEquals(response.status, 429);
  assertEquals(response.headers.get("Retry-After"), "30");
  assertEquals(rateLimitWarningEmitted, true);
});

Deno.test("invalid signature returns 401 and quarantines without processing", async () => {
  let signatureValidated: boolean | undefined;
  let persistStatus: string | undefined;
  let failedCalled = false;
  let warningEmitted = false;
  let processed = false;

  const response = await handleNetcredWebhookRequest(
    webhookRequest('{"id":"evt-1"}', {
      eventType: "TRANSACTION_CAPTURE",
      signature: "deadbeef",
    }),
    createDeps({
      persistWebhookEvent: async (input) => {
        signatureValidated = input.signatureValidated;
        persistStatus = "quarantined";
        return { status: "quarantined", eventId: "event-1" };
      },
      markFailed: async () => {
        failedCalled = true;
      },
      processWebhookEvent: async () => {
        processed = true;
        return { outcome: "processed" };
      },
      emitInvalidSignatureWarning: () => {
        warningEmitted = true;
      },
    }),
  );

  assertEquals(response.status, 401);
  assertEquals(signatureValidated, false);
  assertEquals(persistStatus, "quarantined");
  assertEquals(failedCalled, false);
  assertEquals(warningEmitted, true);
  assertEquals(processed, false);
});

Deno.test("invalid signature auth path is not retryable (no markFailed FAILED)", async () => {
  let markFailedReason = "";
  let persistedValidated: boolean | undefined;

  const response = await handleNetcredWebhookRequest(
    webhookRequest('{"id":"evt-auth-dead"}', {
      eventType: "TRANSACTION_CAPTURE",
      signature: "deadbeef",
    }),
    createDeps({
      persistWebhookEvent: async (input) => {
        persistedValidated = input.signatureValidated;
        return { status: "quarantined", eventId: "event-auth-dead" };
      },
      markFailed: async (_eventId, reason) => {
        markFailedReason = reason;
      },
    }),
  );

  assertEquals(response.status, 401);
  assertEquals(persistedValidated, false);
  // Quarantine is DEAD_LETTER via ingest; handler must not leave retryable FAILED.
  assertEquals(markFailedReason, "");
});

Deno.test("invalid signature does not mutate state beyond quarantine ingest", async () => {
  let persisted = false;
  let warningEmitted = false;
  let duplicateMarked = false;
  let validatingMarked = false;
  let processed = false;
  let queued = false;

  const response = await handleNetcredWebhookRequest(
    webhookRequest('{"id":"evt-invalid"}', {
      eventType: "TRANSACTION_CAPTURE",
      signature: "deadbeef",
    }),
    createDeps({
      persistWebhookEvent: async (input) => {
        persisted = true;
        assertEquals(input.signatureValidated, false);
        return { status: "quarantined", eventId: "event-invalid" };
      },
      markDuplicate: async () => {
        duplicateMarked = true;
      },
      markValidating: async () => {
        validatingMarked = true;
      },
      processWebhookEvent: async () => {
        processed = true;
        return { outcome: "processed" };
      },
      enqueueHeavyProcessing: async () => {
        queued = true;
      },
      emitInvalidSignatureWarning: () => {
        warningEmitted = true;
      },
    }),
  );

  assertEquals(response.status, 401);
  assertEquals(persisted, true);
  assertEquals(warningEmitted, true);
  assertEquals(duplicateMarked, false);
  assertEquals(validatingMarked, false);
  assertEquals(processed, false);
  assertEquals(queued, false);
});

Deno.test("webhook IP rate limit uses failClosed:false (fail-open)", async () => {
  let seenFailClosed: boolean | undefined;

  const response = await handleNetcredWebhookRequest(
    webhookRequest('{"id":"evt-1"}', { eventType: "WEBHOOK_PING" }),
    createDeps({
      checkIPRateLimit: async (_ip, _endpoint, config) => {
        seenFailClosed = config.failClosed;
        return { allowed: false, remaining: 0, retryAfter: 15 };
      },
    }),
  );

  assertEquals(response.status, 429);
  // Prefer accepting webhooks if rate-limit infra is down (payment events).
  assertEquals(seenFailClosed, false);
});

Deno.test("duplicate webhook returns 200 and marks duplicate", async () => {
  let duplicateMarked = false;
  const rawBody = '{"id":"evt-dup"}';
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, { eventType: "WEBHOOK_PING", signature }),
    createDeps({
      persistWebhookEvent: async (input) => {
        assertEquals(input.signatureValidated, true);
        return {
          status: "duplicate",
          eventId: "event-dup",
        };
      },
      markDuplicate: async () => {
        duplicateMarked = true;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(duplicateMarked, true);
});

Deno.test("WEBHOOK_PING is processed inline via RPC", async () => {
  let processed = false;
  let queued = false;

  const rawBody = '{"id":"ping-1"}';
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, {
      eventType: "WEBHOOK_PING",
      signature,
    }),
    createDeps({
      processWebhookEvent: async () => {
        processed = true;
        return { outcome: "noop" };
      },
      enqueueHeavyProcessing: async () => {
        queued = true;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(processed, true);
  assertEquals(queued, false);
});

Deno.test("TRANSACTION_UPDATE enqueues without inline RPC processing", async () => {
  let processed = false;
  let queued = false;

  const rawBody = '{"id":"evt-update"}';
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, {
      eventType: "TRANSACTION_UPDATE",
      signature,
    }),
    createDeps({
      processWebhookEvent: async () => {
        processed = true;
        return { outcome: "processed" };
      },
      enqueueHeavyProcessing: async () => {
        queued = true;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(processed, false);
  assertEquals(queued, true);
});

Deno.test("PAYOUT_CREATE with few movements processes inline", async () => {
  let processed = false;
  let queued = false;

  const rawBody = JSON.stringify({
    id: "payout-1",
    movements: [{ id: 1, transaction_id: 2 }],
  });
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, {
      eventType: "PAYOUT_CREATE",
      signature,
    }),
    createDeps({
      processWebhookEvent: async () => {
        processed = true;
        return { outcome: "processed", handler: { outcome: "upserted" } };
      },
      enqueueHeavyProcessing: async () => {
        queued = true;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(processed, true);
  assertEquals(queued, false);
});

Deno.test("PAYOUT_SETTLE with many movements enqueues heavy path", async () => {
  let processed = false;
  let queued = false;

  const movements = Array.from({ length: 21 }, (_, i) => ({ id: i }));
  const rawBody = JSON.stringify({ id: "payout-big", movements });
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, {
      eventType: "PAYOUT_SETTLE",
      signature,
    }),
    createDeps({
      processWebhookEvent: async () => {
        processed = true;
        return { outcome: "processed" };
      },
      enqueueHeavyProcessing: async () => {
        queued = true;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(processed, false);
  assertEquals(queued, true);
});

Deno.test("PAYOUT not_found handler outcome enqueues deferred processing", async () => {
  let queued = false;

  const rawBody = JSON.stringify({
    id: "payout-retry",
    movements: [{ id: 1 }],
  });
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, {
      eventType: "PAYOUT_CREATE",
      signature,
    }),
    createDeps({
      processWebhookEvent: async () => ({
        outcome: "retry_scheduled",
        handler: { outcome: "not_found" },
      }),
      enqueueHeavyProcessing: async () => {
        queued = true;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(queued, true);
});

Deno.test("retry_scheduled RPC outcome enqueues deferred processing", async () => {
  let queued = false;

  const rawBody = '{"id":"evt-retry"}';
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, {
      eventType: "TRANSACTION_CAPTURE",
      signature,
    }),
    createDeps({
      processWebhookEvent: async () => ({ outcome: "retry_scheduled" }),
      enqueueHeavyProcessing: async () => {
        queued = true;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(queued, true);
});

Deno.test("handler skipped outcome enqueues deferred processing", async () => {
  let queued = false;

  const rawBody = '{"id":"evt-skipped"}';
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, {
      eventType: "TRANSACTION_CAPTURE",
      signature,
    }),
    createDeps({
      processWebhookEvent: async () => ({
        outcome: "processed",
        handler: { outcome: "skipped" },
      }),
      enqueueHeavyProcessing: async () => {
        queued = true;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(queued, true);
});

Deno.test("OPTIONS returns 204 and GET returns 405", async () => {
  const options = await handleNetcredWebhookRequest(
    new Request("https://example.com/netcred-webhook", { method: "OPTIONS" }),
    createDeps(),
  );
  assertEquals(options.status, 204);

  const get = await handleNetcredWebhookRequest(
    new Request("https://example.com/netcred-webhook", { method: "GET" }),
    createDeps(),
  );
  assertEquals(get.status, 405);
});

Deno.test("persist failure returns 500", async () => {
  const rawBody = '{"id":"evt-1"}';
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, { eventType: "WEBHOOK_PING", signature }),
    createDeps({
      persistWebhookEvent: async () => {
        throw new Error("db unavailable");
      },
    }),
  );
  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.error, "persist_failed");
});

Deno.test("process failure marks failed and still returns 200", async () => {
  let failedReason = "";
  const rawBody = '{"id":"evt-fail"}';
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, {
      eventType: "TRANSACTION_CAPTURE",
      signature,
    }),
    createDeps({
      processWebhookEvent: async () => {
        throw new Error("rpc exploded");
      },
      markFailed: async (_eventId, reason) => {
        failedReason = reason;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(failedReason, "rpc exploded");
});

Deno.test("buildSummary returns outcome payload", () => {
  assertEquals(buildSummary("WEBHOOK_PING", "processed", "event-1"), {
    outcome: "processed",
    event_type: "WEBHOOK_PING",
    event_id: "event-1",
  });
});

Deno.test("TRANSACTION_CAPTURE processes inline and persists NetCred transaction payload id", async () => {
  // Shape from Postman TransactionWebhook sample (numeric id + nested charge).
  const rawBody = JSON.stringify({
    id: 123456,
    uuid: "f6412196-35fb-4716-b308-0e2cfea7c970",
    transaction_state: "PAID",
    amount: "10.00",
    paid_amount: "10.00",
    refunded_amount: "0.00",
    charge: { id: 44892, reference_code: "service-1" },
  });
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  let persistedEventId: string | undefined;
  let processedEventId: string | undefined;
  let queued = false;
  let capturedProviderEventId: string | undefined;

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, {
      eventType: "TRANSACTION_CAPTURE",
      signature,
    }),
    createDeps({
      persistWebhookEvent: async (input) => {
        capturedProviderEventId = input.providerEventId;
        return { status: "inserted", eventId: "event-capture-1" };
      },
      processWebhookEvent: async (eventId) => {
        processedEventId = eventId;
        return { outcome: "processed", handler: { outcome: "applied" } };
      },
      enqueueHeavyProcessing: async () => {
        queued = true;
      },
      markValidating: async (eventId) => {
        persistedEventId = eventId;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(capturedProviderEventId, "123456");
  assertEquals(persistedEventId, "event-capture-1");
  assertEquals(processedEventId, "event-capture-1");
  assertEquals(queued, false);
  assertEquals(await response.text(), "OK");
});

Deno.test("TRANSACTION_REFUND is processed inline like CAPTURE (not heavy path)", async () => {
  const rawBody = JSON.stringify({
    id: "tx-refund-1",
    transaction_state: "REFUNDED",
    refunded_amount: "1000.00",
  });
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  let processed = false;
  let queued = false;

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, {
      eventType: "TRANSACTION_REFUND",
      signature,
    }),
    createDeps({
      processWebhookEvent: async () => {
        processed = true;
        return { outcome: "processed" };
      },
      enqueueHeavyProcessing: async () => {
        queued = true;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(processed, true);
  assertEquals(queued, false);
});

Deno.test("handler not_found outcome enqueues deferred processing", async () => {
  let queued = false;
  const rawBody = '{"id":"evt-not-found"}';
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, {
      eventType: "TRANSACTION_CAPTURE",
      signature,
    }),
    createDeps({
      processWebhookEvent: async () => ({
        outcome: "processed",
        handler: { outcome: "not_found" },
      }),
      enqueueHeavyProcessing: async () => {
        queued = true;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(queued, true);
});

Deno.test("persist failure with non-Error still returns persist_failed", async () => {
  const rawBody = '{"id":"evt-1"}';
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, { eventType: "WEBHOOK_PING", signature }),
    createDeps({
      persistWebhookEvent: async () => {
        throw "db unavailable string";
      },
    }),
  );

  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.error, "persist_failed");
});

Deno.test("missing X-NETCRED-Event defaults to UNKNOWN and still accepts valid signature", async () => {
  const rawBody = '{"id":"evt-unknown-type"}';
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);
  let seenEventType: string | undefined;

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, { signature }),
    createDeps({
      persistWebhookEvent: async (input) => {
        seenEventType = input.eventType;
        return { status: "inserted", eventId: "event-unknown" };
      },
      processWebhookEvent: async () => ({ outcome: "processed" }),
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(seenEventType, "UNKNOWN");
});

Deno.test("process failure with non-Error still returns 200 after markFailed", async () => {
  let failedReason = "";
  const rawBody = '{"id":"evt-fail-string"}';
  const signature = await computeHMACSHA256("test-webhook-secret", rawBody);

  const response = await handleNetcredWebhookRequest(
    webhookRequest(rawBody, {
      eventType: "TRANSACTION_CAPTURE",
      signature,
    }),
    createDeps({
      processWebhookEvent: async () => {
        throw "rpc exploded string";
      },
      markFailed: async (_eventId, reason) => {
        failedReason = reason;
      },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(failedReason, "rpc exploded string");
});

Deno.test("rate limit without retryAfter still returns Retry-After header default 60", async () => {
  const response = await handleNetcredWebhookRequest(
    webhookRequest('{"id":"evt-1"}', { eventType: "WEBHOOK_PING" }),
    createDeps({
      checkIPRateLimit: async () => ({
        allowed: false,
        remaining: 0,
        retryAfter: 0,
      }),
    }),
  );

  assertEquals(response.status, 429);
  assertEquals(response.headers.get("Retry-After"), "60");
});
