import { useQuery } from "@tanstack/react-query";
import { fetchClientBudgetDetail } from "../api/clientBudgets.api";

const STALE_TIME_MS = 30_000;

export function useClientBudgetDetail(serviceRequestId: string | null) {
  const query = useQuery({
    queryKey: ["client-budget-detail", serviceRequestId],
    queryFn: async () => {
      // `enabled` is tied to serviceRequestId; when the query runs the id is always set.
      const { data, error } = await fetchClientBudgetDetail(serviceRequestId!);
      if (error) throw new Error(error);
      return data;
    },
    enabled: Boolean(serviceRequestId),
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  return {
    detail: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
