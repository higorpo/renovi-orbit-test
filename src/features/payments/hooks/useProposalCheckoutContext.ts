import { useQuery } from "@tanstack/react-query";
import { getProposalCheckoutContext } from "../api/checkout.api";

export const PROPOSAL_CHECKOUT_CONTEXT_QUERY_KEY = "proposal-checkout-context";

export function useProposalCheckoutContext(
  proposalId: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: [PROPOSAL_CHECKOUT_CONTEXT_QUERY_KEY, proposalId],
    queryFn: async () => {
      if (!proposalId) {
        throw new Error("proposal_id_required");
      }

      const result = await getProposalCheckoutContext(proposalId);
      if (result.error || !result.data) {
        throw new Error(result.error ?? "proposal_checkout_context_failed");
      }

      return result.data;
    },
    enabled: enabled && Boolean(proposalId),
    staleTime: 30_000,
  });
}
