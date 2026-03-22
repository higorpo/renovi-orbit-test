import { useQuery } from "@tanstack/react-query";
import { fetchProviderJobs } from "../api/providerJobs.api";
import type { ProviderJobItem } from "../types/provider-jobs.types";
import { useProviderLocation } from "./useProviderLocation";

const STALE_TIME_MS = 60_000;

/**
 * match-provider-jobs exige lat/lng no body; para busca por `service_request_id` o raio não é aplicado.
 * Usamos fallback quando o prestador ainda não compartilhou localização (ex.: abrindo detalhe a partir de Orçamentos).
 */
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
    queryKey: ["provider-job", jobId, lat, lng],
    queryFn: async () => {
      const { data, error } = await fetchProviderJobs({
        latitude: effectiveLat,
        longitude: effectiveLng,
        radius_km: 10,
        service_request_id: jobId,
        page: 1,
        page_size: 1,
      });
      if (error || !data) throw new Error(error ?? "Erro ao buscar trabalho");
      return data.items[0] ?? null;
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
