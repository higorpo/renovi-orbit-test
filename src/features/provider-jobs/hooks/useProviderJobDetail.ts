import { useQuery } from "@tanstack/react-query";
import { fetchProviderProposalJobDetail } from "../api/providerJobs.api";
import { PROVIDER_PROPOSAL_JOB_DETAIL_QUERY_KEY } from "../constants/queryKeys";
import type { ProviderJobItem } from "../types/provider-jobs.types";
import { useProviderLocation } from "./useProviderLocation";

const STALE_TIME_MS = 60_000;

/** Brazil centroid fallback when provider location is unavailable (RPC needs coordinates for distance/radius). */
const FALLBACK_LAT = -14.235;
const FALLBACK_LNG = -51.9253;

interface UseProviderJobDetailOptions {
  /** When it matches jobId, shown immediately (sheet opened from list). */
  initialJob?: ProviderJobItem | null;
}

export function useProviderJobDetail(
  jobId: string | undefined,
  options?: UseProviderJobDetailOptions,
) {
  const { location } = useProviderLocation();
  const lat = location?.latitude ?? null;
  const lng = location?.longitude ?? null;
  const effectiveLat = lat ?? FALLBACK_LAT;
  const effectiveLng = lng ?? FALLBACK_LNG;
  const initial = options?.initialJob;
  const seeded =
    Boolean(jobId) &&
    initial != null &&
    initial.id === jobId;

  const query = useQuery({
    queryKey: [
      PROVIDER_PROPOSAL_JOB_DETAIL_QUERY_KEY,
      jobId,
      options?.initialJob?.provider_proposal_id ?? null,
      effectiveLat,
      effectiveLng,
    ],
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await fetchProviderProposalJobDetail({
        proposalId: options?.initialJob?.provider_proposal_id ?? null,
        serviceRequestId: jobId,
        latitude: effectiveLat,
        longitude: effectiveLng,
        radiusKm: 10,
      });
      if (error) throw new Error(error);
      return data ?? null;
    },
    enabled: Boolean(jobId),
    initialData: seeded ? initial : undefined,
    initialDataUpdatedAt: seeded ? 0 : undefined,
    refetchOnMount: "always",
    staleTime: STALE_TIME_MS,
  });

  const job: ProviderJobItem | null = query.data ?? null;

  return {
    job,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
