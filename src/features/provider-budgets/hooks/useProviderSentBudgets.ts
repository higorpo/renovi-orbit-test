import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchProviderSentBudgets } from "../api/providerBudgets.api";
import type { PaginatedResponse, ProviderSentBudget } from "../types/provider-budgets.types";

const PAGE_SIZE = 20;
const STALE_TIME_MS = 60_000;

export interface UseProviderSentBudgetsParams {
  status: string | null;
  search: string | null;
}

export function useProviderSentBudgets({ status, search }: UseProviderSentBudgetsParams) {
  const query = useInfiniteQuery<PaginatedResponse<ProviderSentBudget>>({
    queryKey: ["provider-sent-budgets", status, search],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await fetchProviderSentBudgets({
        page: pageParam as number,
        pageSize: PAGE_SIZE,
        status,
        search,
      });
      if (error || !data) throw new Error(error ?? "Erro ao buscar orçamentos");
      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total_count / lastPage.page_size);
      if (lastPage.page >= totalPages) return undefined;
      return lastPage.page + 1;
    },
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const firstPage = query.data?.pages[0];
  const allItems = query.data?.pages.flatMap((p) => p.items) ?? [];
  const totalCount = firstPage?.total_count ?? 0;

  return {
    items: allItems,
    totalCount,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}
