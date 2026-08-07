/**
 * Read-model: get_service_completion_context (Task 45 / design §5.10).
 */

import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { extractRpcErrorCode } from "../utils/rpcErrors";
import type {
  CompletionEvidencePhase,
  CompletionResponsesMap,
  GetServiceCompletionContextResult,
  ServiceCompletionCapabilities,
  ServiceCompletionContext,
  ServiceCompletionContracted,
  ServiceCompletionEnrichment,
  ServiceCompletionEvidence,
} from "../types/completion.types";

type RpcCapabilities = {
  can_mark_executed?: boolean;
  can_save_draft?: boolean;
  can_confirm_with_rating?: boolean;
  can_submit_optional_rating?: boolean;
  show_dispute_stub?: boolean;
};

type RpcEnrichment = {
  status?: string;
  source?: string | null;
  materialized_at?: string | null;
  ops_attention?: boolean;
  schema_version?: number | null;
  checklist_schema?: Record<string, unknown> | null;
};

type RpcContracted = {
  id?: string | null;
  status?: string | null;
  executed_at?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  provider_id?: string | null;
  client_id?: string | null;
};

type RpcEvidence = {
  phase?: string;
  frozen_at?: string | null;
  draft_version?: number | null;
  responses?: CompletionResponsesMap | null;
  auto_executed_without_checklist?: boolean | null;
};

type RpcContext = {
  service_request_id?: string;
  enrichment?: RpcEnrichment | null;
  contracted_service?: RpcContracted;
  evidence?: RpcEvidence;
  capabilities?: RpcCapabilities;
};

function mapCapabilities(raw: RpcCapabilities | undefined): ServiceCompletionCapabilities {
  return {
    canMarkExecuted: Boolean(raw?.can_mark_executed),
    canSaveDraft: Boolean(raw?.can_save_draft),
    canConfirmWithRating: Boolean(raw?.can_confirm_with_rating),
    canSubmitOptionalRating: Boolean(raw?.can_submit_optional_rating),
    showDisputeStub: Boolean(raw?.show_dispute_stub),
  };
}

function mapEnrichment(raw: RpcEnrichment | null | undefined): ServiceCompletionEnrichment | null {
  if (!raw?.status) return null;
  return {
    status: raw.status as ServiceCompletionEnrichment["status"],
    source: (raw.source as ServiceCompletionEnrichment["source"]) ?? null,
    materializedAt: raw.materialized_at ?? null,
    opsAttention: Boolean(raw.ops_attention),
    schemaVersion: raw.schema_version ?? null,
    checklistSchema: raw.checklist_schema ?? null,
  };
}

function mapContracted(raw: RpcContracted | undefined): ServiceCompletionContracted {
  return {
    id: raw?.id ?? null,
    status: raw?.status ?? null,
    executedAt: raw?.executed_at ?? null,
    completedAt: raw?.completed_at ?? null,
    completedBy: raw?.completed_by ?? null,
    providerId: raw?.provider_id ?? null,
    clientId: raw?.client_id ?? null,
  };
}

function coerceDraftVersion(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapEvidence(raw: RpcEvidence | undefined): ServiceCompletionEvidence {
  const phase = (raw?.phase as CompletionEvidencePhase | undefined) ?? "absent";
  return {
    phase,
    frozenAt: raw?.frozen_at ?? null,
    draftVersion: coerceDraftVersion(raw?.draft_version),
    responses: raw?.responses ?? null,
    autoExecutedWithoutChecklist: Boolean(raw?.auto_executed_without_checklist),
  };
}

export function mapServiceCompletionContextRpc(
  raw: RpcContext,
  fallbackServiceRequestId: string,
): ServiceCompletionContext {
  return {
    serviceRequestId: raw.service_request_id ?? fallbackServiceRequestId,
    enrichment: mapEnrichment(raw.enrichment),
    contractedService: mapContracted(raw.contracted_service),
    evidence: mapEvidence(raw.evidence),
    capabilities: mapCapabilities(raw.capabilities),
  };
}

export async function getServiceCompletionContext(
  serviceRequestId: string,
): Promise<GetServiceCompletionContextResult> {
  const { data, error } = await supabase.rpc(
    "get_service_completion_context" as never,
    { p_service_request_id: serviceRequestId } as never,
  );

  if (error) {
    const errorCode = extractRpcErrorCode(error);
    logger.warn("get_service_completion_context_failed", {
      serviceRequestId,
      errorCode,
      error: error.message,
    });
    return { data: null, error: error.message };
  }

  return {
    data: mapServiceCompletionContextRpc(
      (data ?? {}) as RpcContext,
      serviceRequestId,
    ),
    error: null,
  };
}
