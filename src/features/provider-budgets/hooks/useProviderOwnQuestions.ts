import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchProviderOwnQuestions } from "../api/providerBudgets.api";
import type { PaginatedResponse, ProviderOwnQuestion } from "../types/provider-budgets.types";

const PAGE_SIZE = 20;
const STALE_TIME_MS = 60_000;

export interface UseProviderOwnQuestionsParams {
  questionStatus: string | null;
  search: string | null;
  enabled?: boolean;
}

export function useProviderOwnQuestions({
  questionStatus,
  search,
  enabled = true,
}: UseProviderOwnQuestionsParams) {
  const query = useInfiniteQuery<PaginatedResponse<ProviderOwnQuestion>>({
    queryKey: ["provider-own-questions", questionStatus, search],
    enabled,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await fetchProviderOwnQuestions({
        page: pageParam as number,
        pageSize: PAGE_SIZE,
        questionStatus,
        search,
      });
      if (error || !data) throw new Error(error ?? "Erro ao buscar perguntas");
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
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const firstPage = query.data?.pages[0];
  const allItems = query.data?.pages.flatMap((p) => p?.items ?? []) ?? [];
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
