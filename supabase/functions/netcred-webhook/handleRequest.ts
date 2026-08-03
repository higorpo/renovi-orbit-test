import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/jsonResponse.ts";
import {
  createPaymentLogger,
  PAYMENT_LOG_EVENTS,
} from "../_shared/observability/payment-logger.ts";
import { getClientIP } from "../_shared/rateLimiter.ts";
import {
  checkIPRateLimit,
  emitIPRateLimitWarning,
  type IPRateLimitConfig,
} from "../_shared/security/rate-limit.ts";
import {
  extractGatewayTransactionIdFromPayload,
  isTransactionSettlementEnrichEvent,
  type EnrichSettlementResult,
} from "../_shared/payment/enrichSettlementMovements.ts";
import {
  extractProviderEventId,
  parseWebhookPayload,
} from "./parseWebhook.ts";
import type {
  NetcredWebhookRunSummary,
  PersistWebhookInput,
  PersistWebhookResult,
  ProcessWebhookRpcResult,
} from "./types.ts";
import { validateNetcredWebhookSignature } from "./validateSignature.ts";
import {
  isHeavyPathEventType,
  shouldEnqueueAfterProcess,
} from "./webhookRouting.ts";

const logger = createPaymentLogger("netcred-webhook");
const WEBHOOK_ENDPOINT = "netcred-webhook";
const RATE_LIMIT_CONFIG: IPRateLimitConfig = { perMinute: 500, failClosed: false };

export type NetcredWebhookDeps = {
  getWebhookSecret: () => Promise<string>;
  persistWebhookEvent: (input: PersistWebhookInput) => Promise<PersistWebhookResult>;
  markDuplicate: (eventId: string) => Promise<void>;
  markFailed: (eventId: string, failureReason: string) => Promise<void>;
  markValidating: (eventId: string) => Promise<void>;
  processWebhookEvent: (eventId: string) => Promise<ProcessWebhookRpcResult>;
  enqueueHeavyProcessing: (input: {
    eventId: string;
    eventType: string;
  }) => Promise<void>;
  /**
   * Best-effort GraphQL settle enrich after CAPTURE/REFUND SQL success.
   * Must not throw — webhook ACK stays independent of GraphQL/upsert outcome.
   */
  enrichSettlementMovementsForTransaction?: (
    transactionId: string,
  ) => Promise<EnrichSettlementResult | void>;
  emitInvalidSignatureWarning: (extra: Record<string, unknown>) => void;
  emitTransactionDisputeCritical?: (extra: {
    schedule_id: string;
    service_id: string;
    event_id?: string;
    gateway_transaction_id?: string | null;
  }) => void;
  checkIPRateLimit: typeof checkIPRateLimit;
  emitIPRateLimitWarning: typeof emitIPRateLimitWarning;
};

function headersToRecord(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

async function enqueueDeferredProcessing(
  deps: NetcredWebhookDeps,
  eventId: string,
  eventType: string,
): Promise<void> {
  await deps.enqueueHeavyProcessing({ eventId, eventType });
}

async function maybeEnrichSettlementMovements(
  deps: NetcredWebhookDeps,
  eventType: string,
  payload: Record<string, unknown>,
  correlationId: string | null,
): Promise<void> {
  if (!deps.enrichSettlementMovementsForTransaction) {
    return;
  }
  if (!isTransactionSettlementEnrichEvent(eventType)) {
    return;
  }

  const transactionId = extractGatewayTransactionIdFromPayload(payload);
  if (!transactionId) {
    logger.warn("settlement_enrich_skipped", {
      event_type: eventType,
      gateway_slug: "netcred",
      correlation_id: correlationId,
      reason: "missing_gateway_transaction_id",
    });
    return;
  }

  try {
    const result = await deps.enrichSettlementMovementsForTransaction(
      transactionId,
    );
    const outcome = result && typeof result === "object"
      ? result.outcome
      : "unknown";
    const logFields = {
      event_type: eventType,
      gateway_slug: "netcred",
      correlation_id: correlationId,
      gateway_transaction_id: transactionId,
      outcome,
      upserted: result && typeof result === "object" ? result.upserted : undefined,
      movement_count: result && typeof result === "object"
        ? result.movementCount
        : undefined,
      error: result && typeof result === "object" ? result.error : undefined,
    };
    if (outcome === "failure") {
      logger.warn("settlement_enrich_completed", logFields);
    } else {
      logger.info("settlement_enrich_completed", logFields);
    }
  } catch (error) {
    // Never fail webhook ACK on GraphQL/upsert problems — cron backfills.
    logger.warn("settlement_enrich_failed", {
      event_type: eventType,
      gateway_slug: "netcred",
      correlation_id: correlationId,
      gateway_transaction_id: transactionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleNetcredWebhookRequest(
  req: Request,
  deps: NetcredWebhookDeps,
): Promise<Response> {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  const clientIp = getClientIP(req);
  const rateLimit = await deps.checkIPRateLimit(
    clientIp,
    WEBHOOK_ENDPOINT,
    RATE_LIMIT_CONFIG,
  );

  if (!rateLimit.allowed) {
    logger.warn("webhook_rate_limit_exceeded", {
      source_ip: clientIp,
      endpoint: WEBHOOK_ENDPOINT,
      retry_after: rateLimit.retryAfter,
    });
    await deps.emitIPRateLimitWarning({
      endpoint: WEBHOOK_ENDPOINT,
      sourceIp: clientIp,
      retryAfter: rateLimit.retryAfter,
    });
    return jsonResponse(
      { error: "rate_limit_exceeded" },
      429,
      { ...cors, "Retry-After": String(rateLimit.retryAfter || 60) },
    );
  }

  const startedAt = performance.now();

  const rawBody = await req.text();
  const eventType = req.headers.get("X-NETCRED-Event")?.trim() || "UNKNOWN";
  const signature = req.headers.get("X-NETCRED-Signature")?.trim() || "";
  const payload = parseWebhookPayload(rawBody);
  const providerEventId = await extractProviderEventId(rawBody, payload);
  const headersRecord = headersToRecord(req);

  // Prefer HMAC before processable persist (CHK-023).
  const secret = await deps.getWebhookSecret();
  const signatureValid = await validateNetcredWebhookSignature(
    rawBody,
    signature,
    secret,
  );

  let persistResult: PersistWebhookResult;
  try {
    persistResult = await deps.persistWebhookEvent({
      gatewaySlug: "netcred",
      eventType,
      providerEventId,
      rawPayload: payload,
      rawHeaders: headersRecord,
      signatureValidated: signatureValid,
    });
  } catch (error) {
    logger.error("webhook_persist_failed", {
      event_type: eventType,
      gateway_event_id: providerEventId,
      gateway_slug: "netcred",
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({ error: "persist_failed" }, 500, cors);
  }

  logger.info(PAYMENT_LOG_EVENTS.WEBHOOK_RECEIVED, {
    event_type: eventType,
    gateway_event_id: providerEventId,
    gateway_slug: "netcred",
    correlation_id: providerEventId,
    signature_validated: signatureValid,
  });

  if (!signatureValid) {
    deps.emitInvalidSignatureWarning({
      event_type: eventType,
      gateway_event_id: providerEventId,
      source_ip: clientIp,
      event_id: persistResult.eventId,
    });
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  if (persistResult.status === "duplicate") {
    await deps.markDuplicate(persistResult.eventId);
    logger.info(PAYMENT_LOG_EVENTS.WEBHOOK_PROCESSED, {
      event_type: eventType,
      gateway_event_id: providerEventId,
      gateway_slug: "netcred",
      processing_duration_ms: Math.round(performance.now() - startedAt),
      outcome: "duplicate",
      correlation_id: providerEventId,
    });
    return new Response("OK", { status: 200, headers: cors });
  }

  await deps.markValidating(persistResult.eventId);

  try {
    if (isHeavyPathEventType(eventType, payload)) {
      await enqueueDeferredProcessing(deps, persistResult.eventId, eventType);
      logger.info(PAYMENT_LOG_EVENTS.WEBHOOK_PROCESSED, {
        event_type: eventType,
        gateway_event_id: providerEventId,
        gateway_slug: "netcred",
        processing_duration_ms: Math.round(performance.now() - startedAt),
        outcome: "queued",
        event_id: persistResult.eventId,
        correlation_id: providerEventId,
      });
      return new Response("OK", { status: 200, headers: cors });
    }

    const processResult = await deps.processWebhookEvent(persistResult.eventId);

    const disputeAlert = processResult.handler?.sentry_alert;
    if (
      processResult.handler?.outcome === "disputed" &&
      disputeAlert?.schedule_id &&
      disputeAlert.service_id &&
      deps.emitTransactionDisputeCritical
    ) {
      deps.emitTransactionDisputeCritical({
        schedule_id: disputeAlert.schedule_id,
        service_id: disputeAlert.service_id,
        event_id: disputeAlert.event_id ?? persistResult.eventId,
        gateway_transaction_id: disputeAlert.gateway_transaction_id,
      });
    }

    if (shouldEnqueueAfterProcess(processResult)) {
      await enqueueDeferredProcessing(deps, persistResult.eventId, eventType);
      logger.info(PAYMENT_LOG_EVENTS.WEBHOOK_PROCESSED, {
        event_type: eventType,
        gateway_event_id: providerEventId,
        gateway_slug: "netcred",
        processing_duration_ms: Math.round(performance.now() - startedAt),
        outcome: "queued",
        event_id: persistResult.eventId,
        rpc_outcome: processResult.outcome,
        correlation_id: providerEventId,
      });
      return new Response("OK", { status: 200, headers: cors });
    }

    await maybeEnrichSettlementMovements(
      deps,
      eventType,
      payload,
      providerEventId,
    );

    logger.info(PAYMENT_LOG_EVENTS.WEBHOOK_PROCESSED, {
      event_type: eventType,
      gateway_event_id: providerEventId,
      gateway_slug: "netcred",
      processing_duration_ms: Math.round(performance.now() - startedAt),
      outcome: "processed",
      event_id: persistResult.eventId,
      rpc_outcome: processResult.outcome,
      correlation_id: providerEventId,
    });
    return new Response("OK", { status: 200, headers: cors });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error);
    await deps.markFailed(persistResult.eventId, failureReason);
    logger.warn(PAYMENT_LOG_EVENTS.WEBHOOK_PROCESSED, {
      event_type: eventType,
      gateway_event_id: providerEventId,
      gateway_slug: "netcred",
      processing_duration_ms: Math.round(performance.now() - startedAt),
      outcome: "failed",
      event_id: persistResult.eventId,
      error: failureReason,
      correlation_id: providerEventId,
    });
    return new Response("OK", { status: 200, headers: cors });
  }
}

export function buildSummary(
  eventType: string,
  outcome: NetcredWebhookRunSummary["outcome"],
  eventId?: string,
): NetcredWebhookRunSummary {
  return { outcome, event_type: eventType, event_id: eventId };
}
