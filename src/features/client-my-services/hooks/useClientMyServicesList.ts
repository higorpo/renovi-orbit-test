import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { listServiceRequests } from "../api/serviceRequests.api";
import { mapToServiceRequestCardModel } from "../utils/serviceRequestCardMapper";
import type { StatusTabId } from "../constants/statusTabs";
import type { ServiceRequestCardModel } from "../types/client-my-services.types";

const QUERY_KEY = ["client-my-services", "list"];
const PAGE_SIZE = 20;
const STALE_TIME_MS = 60_000;

export interface UseClientMyServicesListParams {
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
}

export interface UseClientMyServicesListResult {
  items: ServiceRequestCardModel[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  hasNextPage: boolean;
  totalCount: number;
  fetchNextPage: () => Promise<unknown>;
  refetch: () => void;
}

export function useClientMyServicesList(
  params: UseClientMyServicesListParams
): UseClientMyServicesListResult {
  const { user } = useAuth();
  const clientId = user?.id ?? "";

  const query = useInfiniteQuery({
    queryKey: [
      ...QUERY_KEY,
      clientId,
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
      const result = await listServiceRequests({
        clientId,
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
        throw new Error(result.error ?? "Erro ao carregar");
      }
      return {
        ...result.data,
        items: result.data.items.map(mapToServiceRequestCardModel),
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total_count / lastPage.page_size);
      if (lastPage.page >= totalPages) return undefined;
      return lastPage.page + 1;
    },
    enabled: Boolean(clientId),
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const firstPage = query.data?.pages[0];

  return {
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
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
