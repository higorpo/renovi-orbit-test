import { useQuery } from "@tanstack/react-query";
import { fetchClientBudgetQuestions } from "../api/clientBudgets.api";

const STALE_TIME_MS = 60_000;

export function useClientPendingQuestionsCount() {
  const query = useQuery({
    queryKey: ["client-budget-questions", "pending-total-count"],
    queryFn: async () => {
      const { data, error } = await fetchClientBudgetQuestions({
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
