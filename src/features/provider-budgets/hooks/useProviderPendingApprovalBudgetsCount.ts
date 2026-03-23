import { useQuery } from "@tanstack/react-query";
import { fetchProviderSentBudgets } from "../api/providerBudgets.api";

const STALE_TIME_MS = 60_000;

/** Count of proposals with status `submitted` (awaiting client decision), independent of list filters. */
export function useProviderPendingApprovalBudgetsCount() {
  const query = useQuery({
    queryKey: ["provider-sent-budgets", "submitted-total-count"],
    queryFn: async () => {
      const { data, error } = await fetchProviderSentBudgets({
        page: 1,
        pageSize: 1,
        status: "submitted",
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
