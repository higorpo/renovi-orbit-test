import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getClientServiceJourney } from "../api/services.api";
import { SERVICE_JOURNEY_QUERY_KEY } from "../constants/queryKeys";
import { presentServiceJourneyMilestones } from "../utils/presentServiceJourney";
import type { PresentedServiceJourneyMilestone } from "../types/serviceJourney.types";

export interface UseClientServiceJourneyParams {
  serviceRequestId: string | undefined;
  /** Client-only; disables the query for providers. */
  enabled?: boolean;
  /** When CS is COMPLETED without a rating (optional evaluation). */
  ratingOptional?: boolean;
}

export interface UseClientServiceJourneyResult {
  milestones: PresentedServiceJourneyMilestone[];
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
}

export function useClientServiceJourney({
  serviceRequestId,
  enabled = true,
  ratingOptional = false,
}: UseClientServiceJourneyParams): UseClientServiceJourneyResult {
  const id = serviceRequestId?.trim() ?? "";

  const query = useQuery({
    queryKey: [...SERVICE_JOURNEY_QUERY_KEY, id],
    queryFn: async () => {
      const result = await getClientServiceJourney(id);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: Boolean(id) && enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const milestones = useMemo(() => {
    if (!query.data?.milestones) return [];
    return presentServiceJourneyMilestones(query.data.milestones, {
      ratingOptional,
    });
  }, [query.data, ratingOptional]);

  return {
    milestones,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
  };
}
