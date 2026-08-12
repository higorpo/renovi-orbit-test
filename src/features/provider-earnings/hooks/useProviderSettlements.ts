import { useInfiniteQuery } from "@tanstack/react-query";
import { listProviderSettlements } from "../api/settlements.api";
import { getSettlementFilterConfig } from "../constants/filterTabs";
import { providerSettlementsQueryKey } from "../constants/queryKeys";
import type { SettlementFilterId, SettlementMovement } from "../types/settlements.types";

const PAGE_SIZE = 20;
const STALE_TIME_MS = 30_000;

export interface UseProviderSettlementsParams {
  filterId?: SettlementFilterId;
  settlingFrom?: string | null;
  settlingTo?: string | null;
  enabled?: boolean;
}

export function useProviderSettlements(params: UseProviderSettlementsParams = {}) {
  const filterId = params.filterId ?? "all";
  const settlingFrom = params.settlingFrom ?? null;
  const settlingTo = params.settlingTo ?? null;
  const filter = getSettlementFilterConfig(filterId);

  const query = useInfiniteQuery({
    queryKey: providerSettlementsQueryKey(filterId, settlingFrom, settlingTo),
    queryFn: async ({ pageParam }) => {
      const result = await listProviderSettlements({
        page: pageParam as number,
        pageSize: PAGE_SIZE,
        movementStatus: filter.movementStatus,
        recordType: filter.recordType,
        settlingFrom,
        settlingTo,
      });
      if (result.error || !result.data) {
        throw new Error(result.error ?? "Erro ao carregar ganhos");
      }
      return result.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total_count / lastPage.page_size);
      if (lastPage.page >= totalPages) return undefined;
      return lastPage.page + 1;
    },
    enabled: params.enabled !== false,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const firstPage = query.data?.pages[0];

  return {
    items: (query.data?.pages.flatMap((page) => page.items) ?? []) as SettlementMovement[],
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    hasNextPage: query.hasNextPage ?? false,
    totalCount: firstPage?.total_count ?? 0,
    fetchNextPage: query.fetchNextPage,
    refetch: () => {
      void query.refetch();
    },
  };
}
