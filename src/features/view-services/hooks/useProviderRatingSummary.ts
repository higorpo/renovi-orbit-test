import { useQuery } from "@tanstack/react-query";
import { getProviderRatingSummary } from "../api/providerRatingSummary.api";

export const PROVIDER_RATING_SUMMARY_QUERY_KEY = ["provider-rating-summary"] as const;

export function useProviderRatingSummary(providerId: string | null | undefined) {
  return useQuery({
    queryKey: [...PROVIDER_RATING_SUMMARY_QUERY_KEY, providerId ?? ""],
    queryFn: async () => {
      if (!providerId) return null;
      const { summary, error } = await getProviderRatingSummary(providerId);
      if (error) throw new Error(error);
      return summary;
    },
    enabled: Boolean(providerId),
    staleTime: 60_000,
  });
}
