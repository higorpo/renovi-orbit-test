import "xhr";
import { servePaymentFunction } from "../_shared/observability/sentry.ts";
import type { Json } from "../_shared/database.types.ts";
import { emitInvalidWebhookSignatureWarning } from "../_shared/observability/payment-sentry-matrix.ts";
import { captureTransactionDisputeCritical } from "../_shared/observability/payment-sentry-matrix.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  checkIPRateLimit,
  emitIPRateLimitWarning,
} from "../_shared/security/rate-limit.ts";
import { getEnvSecret } from "../_shared/getEnvSecret.ts";
import { NetCredAdapter } from "../_shared/payment/index.ts";
import {
  enrichSettlementMovementsForTransaction,
} from "../_shared/payment/enrichSettlementMovements.ts";
import { resolveIsProduction } from "../_shared/payment/netcred-auth.ts";
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
  status: "inserted" | "duplicate" | "quarantined";
  event_id: string;
};

type WebhookEventState =
  | "DUPLICATE"
  | "VALIDATING"
  | "PROCESSING"
  | "PROCESSED"
  | "FAILED"
  | "DEAD_LETTER";

function parseIngestResult(data: unknown): IngestRpcResult {
  return data as IngestRpcResult;
}

function parseProcessResult(data: unknown): ProcessWebhookRpcResult {
  return data as ProcessWebhookRpcResult;
}

function resolvePlatformCompanyId(): string {
  const value = Deno.env.get("NETCRED_PLATFORM_COMPANY_ID")?.trim();
  if (!value) {
    throw new Error("NETCRED_PLATFORM_COMPANY_ID is not configured");
  }
  return value;
}

function resolvePlatformBankAccountId(): string {
  const value = Deno.env.get("NETCRED_PLATFORM_BANK_ACCOUNT_ID")?.trim();
  if (!value) {
    throw new Error("NETCRED_PLATFORM_BANK_ACCOUNT_ID is not configured");
  }
  return value;
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

function createSettlementEnricher(
  supabase: ReturnType<typeof createServiceRoleClient>,
): NetcredWebhookDeps["enrichSettlementMovementsForTransaction"] {
  try {
    const adapter = new NetCredAdapter({
      supabase,
      platformBankAccountId: resolvePlatformBankAccountId(),
      platformCompanyId: resolvePlatformCompanyId(),
      isProduction: resolveIsProduction(),
    });

    return (transactionId) =>
      enrichSettlementMovementsForTransaction(
        {
          listMovementsByTransactionId: (id) =>
            adapter.listMovementsByTransactionId(id),
          upsertSettlementMovements: async (movements) => {
            const { data, error } = await supabase.rpc(
              "payment_upsert_settlement_movements",
              { p_movements: movements as unknown as Json },
            );

            if (error) {
              throw new Error(error.message);
            }

            const result = data as {
              upserted?: number;
              skipped_platform?: number;
              skipped_not_found?: number;
              skipped_invalid?: number;
              results?: unknown[];
            } | null;

            return {
              upserted: Number(result?.upserted ?? 0),
              skipped_platform: Number(result?.skipped_platform ?? 0),
              skipped_not_found: Number(result?.skipped_not_found ?? 0),
              skipped_invalid: Number(result?.skipped_invalid ?? 0),
              results: result?.results,
            };
          },
        },
        transactionId,
      );
  } catch (error) {
    logger.warn("settlement_enrich_deps_unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
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
        p_signature_validated: input.signatureValidated,
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
      // INVALID_SIGNATURE is remapped to DEAD_LETTER by the RPC (non-retryable).
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
    enrichSettlementMovementsForTransaction: createSettlementEnricher(supabase),
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
    emitTransactionDisputeCritical: (extra) => {
      captureTransactionDisputeCritical(extra);
    },
    checkIPRateLimit,
    emitIPRateLimitWarning,
  };
}

servePaymentFunction("netcred-webhook", (req) =>
  handleNetcredWebhookRequest(req, createDeps()));
