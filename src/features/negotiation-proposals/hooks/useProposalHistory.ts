import { useQuery } from "@tanstack/react-query";
import { fetchProviderProposalHistory } from "../api/proposals.api";
import { PROPOSAL_HISTORY_QUERY_KEY } from "../constants/queryKeys";
import type { ProviderProposalHistoryItem } from "../types/proposals.types";

export function useProposalHistory(
  serviceRequestId: string,
  enabled: boolean,
): {
  items: ProviderProposalHistoryItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
} {
  const query = useQuery({
    queryKey: [PROPOSAL_HISTORY_QUERY_KEY, serviceRequestId],
    queryFn: async () => {
      const { data, error } = await fetchProviderProposalHistory(serviceRequestId);
      if (error) throw new Error(error);
      return data;
    },
    enabled: enabled && Boolean(serviceRequestId),
    staleTime: 60_000,
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    errorMessage: query.error instanceof Error ? query.error.message : null,
  };
}
