import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { getLatestProviderProposalForServiceRequest } from "../api/proposals.api";
import { LATEST_PROVIDER_PROPOSAL_QUERY_KEY } from "../constants/queryKeys";

const STALE_TIME_MS = 60_000;

export function useLatestProviderProposal(serviceRequestId: string | undefined) {
  const { user, profile } = useAuth();
  const id = serviceRequestId?.trim() ?? "";
  const providerId = user?.id ?? "";
  const isProvider = profile?.role === "provider";

  return useQuery({
    queryKey: [LATEST_PROVIDER_PROPOSAL_QUERY_KEY, id, providerId],
    queryFn: async () => {
      const result = await getLatestProviderProposalForServiceRequest({
        serviceRequestId: id,
        providerId,
      });
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: Boolean(id) && Boolean(providerId) && isProvider,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
}
