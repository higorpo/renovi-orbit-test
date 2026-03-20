import { useQuery } from "@tanstack/react-query";
import {
  fetchProviderProposalHistory,
  type ProviderProposalHistoryItem,
} from "../api/providerProposals.api";

export function useProviderProposalHistory(
  serviceRequestId: string,
  enabled: boolean,
): {
  items: ProviderProposalHistoryItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
} {
  const query = useQuery({
    queryKey: ["provider-proposals-history", serviceRequestId],
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
