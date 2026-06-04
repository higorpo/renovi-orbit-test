import { useQuery } from "@tanstack/react-query";
import { getProposalDetail } from "@/features/negotiation-proposals/api/proposals.api";
import type { ProposalDetailView } from "@/features/negotiation-proposals/types/proposalDetails.types";
import { CHAT_PROPOSAL_TIMELINE_QUERY_KEY } from "../constants/queryKeys";

const STALE_TIME_MS = 30_000;

export function useProposalTimelineHydration(
  chatId: string,
  proposalId: string | null,
  enabled: boolean,
) {
  const query = useQuery({
    queryKey: [CHAT_PROPOSAL_TIMELINE_QUERY_KEY, chatId, proposalId],
    queryFn: async () => {
      const result = await getProposalDetail(proposalId!, "client");

      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "Erro ao carregar proposta");
      }

      return result.data as ProposalDetailView;
    },
    enabled: Boolean(chatId) && Boolean(proposalId) && enabled,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  return {
    proposal: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
