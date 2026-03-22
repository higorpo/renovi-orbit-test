import { useQuery } from "@tanstack/react-query";
import { fetchProviderOwnQuestions } from "../api/providerBudgets.api";

const STALE_TIME_MS = 60_000;

export function useProviderPendingQuestionsCount() {
  const query = useQuery({
    queryKey: ["provider-own-questions", "pending-total-count"],
    queryFn: async () => {
      const { data, error } = await fetchProviderOwnQuestions({
        page: 1,
        pageSize: 1,
        questionStatus: "pending",
        search: null,
      });
      if (error || !data) throw new Error(error ?? "Erro ao buscar total");
      return data.total_count;
    },
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  return {
    count: query.data ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
