import { useQuery } from "@tanstack/react-query";
import { getActiveServiceRescheduleForChat } from "../api/serviceReschedule.api";
import type { ServiceRescheduleSnapshot } from "../types/serviceReschedule.types";

export const CHAT_ACTIVE_RESCHEDULE_QUERY_KEY = "chat_active_reschedule";

const STALE_TIME_MS = 30_000;

export function useActiveChatReschedule(chatId: string | null, enabled = true) {
  const query = useQuery({
    queryKey: [CHAT_ACTIVE_RESCHEDULE_QUERY_KEY, chatId],
    queryFn: async (): Promise<ServiceRescheduleSnapshot | null> => {
      const result = await getActiveServiceRescheduleForChat(chatId!);
      if (result.error) {
        throw new Error(result.error.message ?? "Erro ao carregar reagendamento ativo");
      }
      return result.data;
    },
    enabled: Boolean(chatId) && enabled,
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
