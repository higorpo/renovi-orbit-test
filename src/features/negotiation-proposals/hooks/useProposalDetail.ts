import { useQuery } from "@tanstack/react-query";
import { getProposalDetail } from "../api/proposals.api";
import { PROPOSAL_DETAIL_QUERY_KEY } from "../constants/queryKeys";
import type { ProposalDetailAudience, ProposalDetailView } from "../types/proposalDetails.types";

const STALE_TIME_MS = 30_000;

export interface UseProposalDetailParams {
  proposalId: string | null;
  enabled?: boolean;
  audience?: ProposalDetailAudience;
}

export function useProposalDetail({
  proposalId,
  enabled = true,
  audience = "provider",
}: UseProposalDetailParams) {
  return useQuery<ProposalDetailView>({
    queryKey: [PROPOSAL_DETAIL_QUERY_KEY, proposalId, audience],
    queryFn: async () => {
      const result = await getProposalDetail(proposalId!, audience);

      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "Erro ao carregar proposta");
      }

      return result.data;
    },
    enabled: Boolean(proposalId) && enabled,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
}
