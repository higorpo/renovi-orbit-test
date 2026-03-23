import { useQuery } from "@tanstack/react-query";
import { fetchClientReceivedBudgets } from "../api/clientBudgets.api";

const STALE_TIME_MS = 60_000;

/** Service groups with at least one budget awaiting client decision (`awaiting_decision`), independent of list filters. */
export function useClientPendingApprovalServicesCount() {
  const query = useQuery({
    queryKey: ["client-received-budgets", "awaiting-decision-total-count"],
    queryFn: async () => {
      const { data, error } = await fetchClientReceivedBudgets({
        page: 1,
        pageSize: 1,
        status: "awaiting_decision",
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
