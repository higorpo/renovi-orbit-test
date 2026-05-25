import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { generateIdempotencyKeyV7 } from "../utils/idempotencyKey";
import type {
  IngestDispatchParams,
  IngestDispatchResult,
  MessageDispatchStatus,
} from "../types/notifications.types";

interface IngestEdgeResponse {
  dispatch_id?: string;
  status?: string;
  scheduled_for?: string;
  duplicate?: boolean;
  error?: string;
}

export interface IngestDispatchApiResult {
  result: IngestDispatchResult | null;
  error: string | null;
}

export async function ingestDispatch(
  params: IngestDispatchParams,
): Promise<IngestDispatchApiResult> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  try {
    const { data, error } = await supabase.functions.invoke("message-dispatcher-ingest", {
      body: {
        idempotencyKey,
        profileId: params.profileId,
        channel: params.channel,
        templateKey: params.templateKey,
        templateVariables: params.templateVariables ?? {},
        scheduledFor: params.scheduledFor,
        sourceSystem: params.sourceSystem ?? "orbit",
        metadata: params.metadata ?? {},
      },
    });

    if (error) {
      logger.error("mmd_ingest_invoke_error", {
        error: error.message,
        profileId: params.profileId,
        channel: params.channel,
      });
      return { result: null, error: error.message };
    }

    const payload = data as IngestEdgeResponse | null;
    if (!payload?.dispatch_id) {
      const message = payload?.error ?? "ingest_failed";
      logger.error("mmd_ingest_response_error", { message, profileId: params.profileId });
      return { result: null, error: message };
    }

    return {
      result: {
        dispatchId: payload.dispatch_id,
        status: (payload.status ?? "QUEUED") as MessageDispatchStatus,
        scheduledFor: payload.scheduled_for ?? new Date().toISOString(),
        duplicate: Boolean(payload.duplicate),
      },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "network_error";
    logger.error("mmd_ingest_network_error", { error: message, profileId: params.profileId });
    return { result: null, error: message };
  }
}
