import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchClientBudgetQuestions } from "../api/clientBudgets.api";
import type { ClientQuestionServiceGroup, PaginatedResponse } from "../types/client-budgets.types";

const PAGE_SIZE = 20;
const STALE_TIME_MS = 60_000;

export function useClientBudgetQuestions(params: {
  questionStatus: string | null;
  search: string | null;
}) {
  const query = useInfiniteQuery<PaginatedResponse<ClientQuestionServiceGroup>>({
    queryKey: ["client-budget-questions", params.questionStatus, params.search],
    queryFn: async ({ pageParam }) => {
      const { data, error } = await fetchClientBudgetQuestions({
        page: pageParam as number,
        pageSize: PAGE_SIZE,
        questionStatus: params.questionStatus,
        search: params.search,
      });
      if (error || !data) throw new Error(error ?? "Erro ao buscar perguntas");
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
