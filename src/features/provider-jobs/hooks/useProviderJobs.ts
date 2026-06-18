import { useInfiniteQuery } from "@tanstack/react-query";
import { providerJobsListQueryKey } from "../constants/queryKeys";
import {
  fetchProviderJobs,
  isInvalidProviderJobsCursorError,
} from "../api/providerJobs.api";
import type { SortMode, ProviderJobsResponse } from "../types/provider-jobs.types";
import { FEED_DEFAULT_LIMIT } from "../types/provider-jobs.types";

/** Data is considered fresh for 1 minute; no refetch during this window */
const STALE_TIME_MS = 60_000;

interface UseProviderJobsParams {
  latitude: number | null;
  longitude: number | null;
  sortMode: SortMode;
}

export function useProviderJobs({
  latitude,
  longitude,
  sortMode,
}: UseProviderJobsParams) {
  const query = useInfiniteQuery<ProviderJobsResponse>({
    queryKey: providerJobsListQueryKey({
      sortMode,
      lat: latitude,
      lng: longitude,
    }),
    queryFn: async ({ pageParam }) => {
      const { data, error } = await fetchProviderJobs({
        sort_mode: sortMode,
        cursor: (pageParam as string | null | undefined) ?? null,
        limit: FEED_DEFAULT_LIMIT,
        lat: latitude,
        lng: longitude,
      });

      if (error || !data) {
        if (isInvalidProviderJobsCursorError(error)) {
          throw new Error("INVALID_PROVIDER_JOBS_CURSOR");
        }
        throw new Error(error ?? "Erro ao buscar trabalhos");
      }

      return data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor ?? undefined : undefined,
    enabled: sortMode !== "nearest" || (latitude != null && longitude != null),
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const items = query.data?.pages.flatMap((page) => page?.items ?? []) ?? [];

  return {
    items,
    loadedCount: items.length,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}
