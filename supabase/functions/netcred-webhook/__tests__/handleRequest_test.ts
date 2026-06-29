import { assertEquals } from "std/testing/asserts";
import { computeHMACSHA256 } from "../../_shared/crypto/hmac.ts";
import {
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

Deno.test("invalid signature returns 401 and marks event failed", async () => {
  let failedReason = "";

  const response = await handleNetcredWebhookRequest(
    webhookRequest('{"id":"evt-1"}', {
      eventType: "TRANSACTION_CAPTURE",
      signature: "deadbeef",
    }),
    createDeps({
      markFailed: async (_eventId, reason) => {
        failedReason = reason;
      },
      emitInvalidSignatureWarning: () => {},
    }),
  );

  assertEquals(response.status, 401);
  assertEquals(failedReason, "INVALID_SIGNATURE");
});

Deno.test("duplicate webhook returns 200 and marks duplicate", async () => {
  let duplicateMarked = false;

  const response = await handleNetcredWebhookRequest(
    webhookRequest('{"id":"evt-dup"}', { eventType: "WEBHOOK_PING" }),
    createDeps({
      persistWebhookEvent: async () => ({
        status: "duplicate",
        eventId: "event-dup",
      }),
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
