import { useMemo } from "react";
import type { EnrichmentStatus } from "../types/completion.types";
import {
  deriveEnrichmentProcessingUi,
  type EnrichmentProcessingUi,
} from "../utils/enrichmentProcessing";

export type EnrichmentProcessingModelFields = {
  enrichmentStatus: EnrichmentStatus | null;
  enrichmentReady: boolean;
  requestStatus?: string | null;
  listPhase?: string | null;
};

/** Lightweight projection from list/detail ServiceModel fields (no extra RPC). */
export function useEnrichmentProcessingFromModel(
  model: EnrichmentProcessingModelFields | null | undefined,
): EnrichmentProcessingUi {
  return useMemo(
    () =>
      deriveEnrichmentProcessingUi({
        enrichmentStatus: model?.enrichmentStatus ?? null,
        enrichmentReady: model?.enrichmentReady ?? false,
        requestStatus: model?.requestStatus ?? null,
        listPhase: model?.listPhase ?? null,
      }),
    [
      model?.enrichmentStatus,
      model?.enrichmentReady,
      model?.requestStatus,
      model?.listPhase,
    ],
  );
}
