/**
 * Provider draft persistence: service_completion_save_evidence_draft.
 */

import { supabase } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";
import { extractRpcErrorCode } from "../utils/rpcErrors";
import type {
  CompletionEvidencePhase,
  SaveEvidenceDraftInput,
  SaveEvidenceDraftResult,
} from "../types/completion.types";

type RpcDraftResponse = {
  contracted_service_id?: string;
  draft_version?: number;
  phase?: string;
};

export async function saveEvidenceDraft(
  input: SaveEvidenceDraftInput,
): Promise<SaveEvidenceDraftResult> {
  const { data, error } = await supabase.rpc(
    "service_completion_save_evidence_draft" as never,
    {
      p_contracted_service_id: input.contractedServiceId,
      p_responses: input.responses,
      p_expected_draft_version: input.expectedDraftVersion ?? null,
    } as never,
  );

  if (error) {
    const errorCode = extractRpcErrorCode(error);
    logger.warn("service_completion_save_evidence_draft_failed", {
      contractedServiceId: input.contractedServiceId,
      errorCode,
      error: error.message,
    });
    return {
      data: null,
      error: error.message,
      errorCode,
    };
  }

  const payload = data as RpcDraftResponse;
  return {
    data: {
      contractedServiceId:
        payload.contracted_service_id ?? input.contractedServiceId,
      draftVersion: payload.draft_version ?? 1,
      phase: (payload.phase as CompletionEvidencePhase) ?? "draft",
    },
    error: null,
  };
}

export const draftApi = {
  saveEvidenceDraft,
};
