import { useInfiniteQuery } from "@tanstack/react-query";
import { Sentry } from "@/lib/sentry";
import { PROVIDER_JOBS_LIST_QUERY_KEY } from "../constants/queryKeys";
import { fetchProviderJobs } from "../api/providerJobs.api";
import type { SortMode, ProviderJobsResponse } from "../types/provider-jobs.types";

const PAGE_SIZE = 20;
/** Data is considered fresh for 1 minute; no refetch during this window */
const STALE_TIME_MS = 60_000;

interface UseProviderJobsParams {
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  serviceId: string | null;
  sortMode: SortMode;
}

export function useProviderJobs({
  latitude,
  longitude,
  radiusKm,
  serviceId,
  sortMode,
}: UseProviderJobsParams) {
  const query = useInfiniteQuery<ProviderJobsResponse>({
    queryKey: [
      PROVIDER_JOBS_LIST_QUERY_KEY,
      latitude,
      longitude,
      radiusKm,
      serviceId,
      sortMode,
    ],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await Sentry.startSpan(
        { name: "provider_jobs.fetch_list", op: "function" },
        async (span) => {
          span?.setAttribute("provider_jobs.page", String(pageParam));
          span?.setAttribute("provider_jobs.page_size", String(PAGE_SIZE));
          span?.setAttribute("provider_jobs.sort_mode", sortMode);
          span?.setAttribute("provider_jobs.has_service_filter", String(Boolean(serviceId)));
          span?.setAttribute("provider_jobs.radius_km", String(radiusKm));

          return fetchProviderJobs({
            latitude: latitude!,
            longitude: longitude!,
            radius_km: radiusKm,
            service_id: serviceId,
            sort_mode: sortMode,
            page: pageParam as number,
            page_size: PAGE_SIZE,
          });
        }
      );
      if (error || !data) throw new Error(error ?? "Erro ao buscar trabalhos");
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { total_count, page_size, page } = lastPage;
      if (
        !Number.isFinite(total_count) ||
        !Number.isFinite(page_size) ||
        !Number.isFinite(page) ||
        page_size <= 0
      ) {
        return undefined;
      }
      const totalPages = Math.ceil(total_count / page_size);
      if (page >= totalPages) return undefined;
      return page + 1;
    },
    enabled: latitude != null && longitude != null,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const firstPage = query.data?.pages[0];
  const allItems =
    query.data?.pages.flatMap((p) => p?.items ?? []) ?? [];
  const totalCount = firstPage?.total_count ?? 0;
  const providerServices = firstPage?.provider_services ?? [];
  const providerAreaSummary = firstPage?.provider_area_summary ?? {
    cities: [],
    neighborhoods: [],
  };

  return {
    items: allItems,
    totalCount,
    providerServices,
    providerAreaSummary,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}
