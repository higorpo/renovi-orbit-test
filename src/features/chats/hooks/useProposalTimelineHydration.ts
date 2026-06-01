import { useQuery } from "@tanstack/react-query";
import { getProposalForTimeline } from "../api/chats.api";
import { CHAT_PROPOSAL_TIMELINE_QUERY_KEY } from "../constants/queryKeys";
import type { TimelineHydratedProposal } from "../types/timelineProposal.types";

const STALE_TIME_MS = 30_000;

export function useProposalTimelineHydration(
  chatId: string,
  proposalId: string | null,
  enabled: boolean,
) {
  const query = useQuery({
    queryKey: [CHAT_PROPOSAL_TIMELINE_QUERY_KEY, chatId, proposalId],
    queryFn: async () => {
      const result = await getProposalForTimeline({
        chatId,
        proposalId: proposalId!,
      });

      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "Erro ao carregar proposta");
      }

      return result.data.proposal as TimelineHydratedProposal;
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
