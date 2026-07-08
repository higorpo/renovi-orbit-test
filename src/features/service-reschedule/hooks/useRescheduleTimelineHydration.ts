import { useQuery } from "@tanstack/react-query";
import { getServiceRescheduleRequest } from "../api/serviceReschedule.api";
import type { ServiceRescheduleSnapshot } from "../types/serviceReschedule.types";

export const CHAT_RESCHEDULE_TIMELINE_QUERY_KEY = "chat_reschedule_timeline";

const STALE_TIME_MS = 30_000;

export function useRescheduleTimelineHydration(
  chatId: string,
  rescheduleRequestId: string | null,
  enabled: boolean,
) {
  const query = useQuery({
    queryKey: [CHAT_RESCHEDULE_TIMELINE_QUERY_KEY, chatId, rescheduleRequestId],
    queryFn: async (): Promise<ServiceRescheduleSnapshot> => {
      const result = await getServiceRescheduleRequest(rescheduleRequestId!);
      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "Erro ao carregar reagendamento");
      }
      return result.data;
    },
    enabled: Boolean(chatId) && Boolean(rescheduleRequestId) && enabled,
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
