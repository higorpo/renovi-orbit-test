import "xhr";
import { servePaymentFunction } from "../_shared/observability/sentry.ts";
import type { Json } from "../_shared/database.types.ts";
import { emitInvalidWebhookSignatureWarning } from "../_shared/observability/payment-sentry-matrix.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  checkIPRateLimit,
  emitIPRateLimitWarning,
} from "../_shared/security/rate-limit.ts";
import { getEnvSecret } from "../_shared/getEnvSecret.ts";
import { createServiceRoleClient } from "../_shared/serviceRoleClient.ts";
import {
  handleNetcredWebhookRequest,
  type NetcredWebhookDeps,
} from "./handleRequest.ts";
import type {
  PersistWebhookInput,
  PersistWebhookResult,
  ProcessWebhookRpcResult,
} from "./types.ts";

const logger = createLogger("netcred-webhook");

type IngestRpcResult = {
  status: "inserted" | "duplicate";
  event_id: string;
};

type WebhookEventState =
  | "DUPLICATE"
  | "VALIDATING"
  | "PROCESSING"
  | "PROCESSED"
  | "FAILED";

function parseIngestResult(data: unknown): IngestRpcResult {
  return data as IngestRpcResult;
}

function parseProcessResult(data: unknown): ProcessWebhookRpcResult {
  return data as ProcessWebhookRpcResult;
}

async function updateWebhookEventState(
  supabase: ReturnType<typeof createServiceRoleClient>,
  eventId: string,
  targetState: WebhookEventState,
  failureReason?: string,
): Promise<void> {
  const { error } = await supabase.rpc("payment_update_webhook_event_state", {
    p_webhook_event_id: eventId,
    p_target_state: targetState,
    p_failure_reason: failureReason,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function createDeps(): NetcredWebhookDeps {
  const supabase = createServiceRoleClient();

  return {
    getWebhookSecret: async () => getEnvSecret("NETCRED_WEBHOOK_SECRET"),
    persistWebhookEvent: async (input: PersistWebhookInput) => {
      const { data, error } = await supabase.rpc("payment_ingest_webhook_event", {
        p_gateway_slug: "netcred",
        p_event_type: input.eventType,
        p_gateway_event_id: input.providerEventId,
        p_raw_payload: input.rawPayload as Json,
        p_raw_headers: input.rawHeaders as Json,
      });

      if (error) {
        throw new Error(error.message);
      }

      const result = parseIngestResult(data);
      return {
        status: result.status,
        eventId: result.event_id,
      } satisfies PersistWebhookResult;
    },
    markDuplicate: async (eventId) => {
      await updateWebhookEventState(supabase, eventId, "DUPLICATE");
    },
    markFailed: async (eventId, failureReason) => {
      await updateWebhookEventState(supabase, eventId, "FAILED", failureReason);
    },
    markValidating: async (eventId) => {
      await updateWebhookEventState(supabase, eventId, "VALIDATING");
    },
    processWebhookEvent: async (eventId) => {
      const { data, error } = await supabase.rpc("payment_process_webhook_event", {
        p_webhook_event_id: eventId,
      });

      if (error) {
        throw new Error(error.message);
      }

      return parseProcessResult(data);
    },
    enqueueHeavyProcessing: async ({ eventId }) => {
      const { error } = await supabase.rpc("payment_enqueue_webhook_processing", {
        p_webhook_event_id: eventId,
        p_scheduled_at: new Date().toISOString(),
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    emitInvalidSignatureWarning: (extra) => {
      logger.warn("webhook_signature_invalid", extra);
      void emitInvalidWebhookSignatureWarning({
        event_type: String(extra.event_type ?? "UNKNOWN"),
        gateway_event_id: extra.gateway_event_id != null
          ? String(extra.gateway_event_id)
          : undefined,
        source_ip: extra.source_ip != null ? String(extra.source_ip) : undefined,
        event_id: extra.event_id != null ? String(extra.event_id) : undefined,
      });
    },
    checkIPRateLimit,
    emitIPRateLimitWarning,
  };
}

servePaymentFunction("netcred-webhook", (req) =>
  handleNetcredWebhookRequest(req, createDeps()));
