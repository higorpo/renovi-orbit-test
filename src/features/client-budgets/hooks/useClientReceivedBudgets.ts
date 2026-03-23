import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchClientReceivedBudgets } from "../api/clientBudgets.api";
import type { ClientReceivedServiceGroup, PaginatedResponse } from "../types/client-budgets.types";

const PAGE_SIZE = 20;
const STALE_TIME_MS = 60_000;

export function useClientReceivedBudgets(params: {
  status: string | null;
  search: string | null;
}) {
  const query = useInfiniteQuery<PaginatedResponse<ClientReceivedServiceGroup>>({
    queryKey: ["client-received-budgets", params.status, params.search],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await fetchClientReceivedBudgets({
        page: pageParam as number,
        pageSize: PAGE_SIZE,
        status: params.status,
        search: params.search,
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
  return {
    items: query.data?.pages.flatMap((page) => page.items) ?? [],
    totalCount: firstPage?.total_count ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    hasNextPage: query.hasNextPage ?? false,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}
