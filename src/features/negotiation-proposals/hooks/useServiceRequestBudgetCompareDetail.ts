import { useQuery } from "@tanstack/react-query";
import { fetchServiceRequestBudgetCompareDetail } from "../api/serviceRequestBudgetCompare.api";
import { SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY } from "../constants/queryKeys";

const STALE_TIME_MS = 30_000;

export function useServiceRequestBudgetCompareDetail(serviceRequestId: string | null) {
  const query = useQuery({
    queryKey: [SERVICE_REQUEST_BUDGET_COMPARE_DETAIL_QUERY_KEY, serviceRequestId],
    queryFn: async () => {
      const { data, error } = await fetchServiceRequestBudgetCompareDetail(serviceRequestId!);
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
