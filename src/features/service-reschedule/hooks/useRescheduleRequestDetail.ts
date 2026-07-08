import { useQuery } from "@tanstack/react-query";
import { getServiceRescheduleRequest } from "../api/serviceReschedule.api";
import type { ServiceRescheduleSnapshot } from "../types/serviceReschedule.types";

export const SERVICE_RESCHEDULE_REQUEST_QUERY_KEY = "service_reschedule_request";

const STALE_TIME_MS = 30_000;

export function useRescheduleRequestDetail(
  rescheduleRequestId: string | null,
  enabled = true,
) {
  const query = useQuery({
    queryKey: [SERVICE_RESCHEDULE_REQUEST_QUERY_KEY, rescheduleRequestId],
    queryFn: async (): Promise<ServiceRescheduleSnapshot> => {
      const result = await getServiceRescheduleRequest(rescheduleRequestId!);
      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "Erro ao carregar reagendamento");
      }
      return result.data;
    },
    enabled: Boolean(rescheduleRequestId) && enabled,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  return {
    snapshot: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
