import { useInfiniteQuery } from "@tanstack/react-query";
import { listServices } from "../api/services.api";
import { SERVICES_LIST_QUERY_KEY } from "../constants/queryKeys";
import type { StatusTabId } from "../constants/statusTabs";
import type { ServiceModel } from "../types/service.types";

const PAGE_SIZE = 20;
const STALE_TIME_MS = 60_000;

export interface UseServicesListParams {
  statusTabId: StatusTabId;
  search: string;
  categoryId: string | null;
  cityName: string | null;
  neighborhoodName: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  hasProposals: boolean | null;
  hasImages: boolean | null;
  serviceRequestId: string | null;
  enabled?: boolean;
}

export function useServicesList(params: UseServicesListParams) {
  const query = useInfiniteQuery({
    queryKey: [
      ...SERVICES_LIST_QUERY_KEY,
      params.statusTabId,
      params.search,
      params.categoryId,
      params.cityName,
      params.neighborhoodName,
      params.dateFrom,
      params.dateTo,
      params.hasProposals,
      params.hasImages,
      params.serviceRequestId,
    ],
    queryFn: async ({ pageParam }) => {
      const result = await listServices({
        page: pageParam as number,
        pageSize: PAGE_SIZE,
        statusTabId: params.statusTabId,
        search: params.search,
        categoryId: params.categoryId,
        cityName: params.cityName,
        neighborhoodName: params.neighborhoodName,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        hasProposals: params.hasProposals,
        hasImages: params.hasImages,
        serviceRequestId: params.serviceRequestId,
      });
      if (result.error || !result.data) {
        throw new Error(result.error ?? "Erro ao carregar serviços");
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
    items: (query.data?.pages.flatMap((page) => page.items) ?? []) as ServiceModel[],
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
