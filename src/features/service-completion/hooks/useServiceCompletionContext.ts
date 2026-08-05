import { useQuery } from "@tanstack/react-query";
import { getServiceCompletionContext } from "../api/context.api";
import { deriveEnrichmentProcessingUi } from "../utils/enrichmentProcessing";
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

export function useServiceCompletionContext(
  serviceRequestId: string | null | undefined,
  options: UseServiceCompletionContextOptions = {},
) {
  const {
    pollWhileProcessing = true,
    requestStatus = null,
    listPhase = null,
  } = options;

  const query = useQuery({
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
      const ui = deriveEnrichmentProcessingUi({
        enrichmentStatus: q.state.data?.enrichment?.status ?? null,
        enrichmentReady: q.state.data?.enrichment?.status === "READY",
        requestStatus,
        listPhase,
      });
      return ui.shouldPoll ? PROCESSING_POLL_MS : false;
    },
  });

  const processingUi = deriveEnrichmentProcessingUi({
    enrichmentStatus: query.data?.enrichment?.status ?? null,
    enrichmentReady: query.data?.enrichment?.status === "READY",
    requestStatus,
    listPhase,
  });

  return {
    ...query,
    processingUi,
  };
}
