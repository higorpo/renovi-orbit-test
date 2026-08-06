import { useQuery } from "@tanstack/react-query";
import type { EnrichmentStatus } from "../types/completion.types";
import { getServiceCompletionContext } from "../api/context.api";
import { serviceCompletionContextQueryKey } from "./queryKeys";

const PROCESSING_POLL_MS = 3_000;
const CONTEXT_STALE_MS = 5_000;

export type UseServiceCompletionContextOptions = {
  /** When false, skips polling even if enrichment is PENDING/RUNNING. Default true. */
  pollWhileProcessing?: boolean;
  /** Cancel / list signals from the service detail model. */
  requestStatus?: string | null;
  listPhase?: string | null;
};

function isRequestCancelled(
  requestStatus?: string | null,
  listPhase?: string | null,
): boolean {
  return (
    (requestStatus ?? "").toUpperCase() === "CANCELLED" ||
    (listPhase ?? "").toLowerCase() === "cancelled"
  );
}

function shouldPollEnrichment(input: {
  enrichmentStatus: EnrichmentStatus | null | undefined;
  requestStatus?: string | null;
  listPhase?: string | null;
}): boolean {
  if (isRequestCancelled(input.requestStatus, input.listPhase)) return false;
  return (
    input.enrichmentStatus === "PENDING" || input.enrichmentStatus === "RUNNING"
  );
}

export function useServiceCompletionContext(
  serviceRequestId: string | null | undefined,
  options: UseServiceCompletionContextOptions = {},
) {
  const {
    pollWhileProcessing = true,
    requestStatus = null,
    listPhase = null,
  } = options;

  return useQuery({
    queryKey: serviceCompletionContextQueryKey(serviceRequestId ?? ""),
    enabled: Boolean(serviceRequestId),
    queryFn: async () => {
      const result = await getServiceCompletionContext(serviceRequestId!);
      if (result.error || !result.data) {
        throw new Error(result.error ?? "Falha ao carregar contexto de conclusão");
      }
      return result.data;
    },
    staleTime: CONTEXT_STALE_MS,
    refetchInterval: (q) => {
      if (!pollWhileProcessing) return false;
      return shouldPollEnrichment({
        enrichmentStatus: q.state.data?.enrichment?.status ?? null,
        requestStatus,
        listPhase,
      })
        ? PROCESSING_POLL_MS
        : false;
    },
  });
}
