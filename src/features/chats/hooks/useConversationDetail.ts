import { useQuery } from "@tanstack/react-query";
import { getConversationDetail } from "../api/chats.api";
import { CONVERSATION_DETAIL_QUERY_KEY } from "../constants/queryKeys";

const STALE_TIME_MS = 30_000;

export function useConversationDetail(chatId: string | null, options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: [CONVERSATION_DETAIL_QUERY_KEY, chatId],
    queryFn: async () => {
      const result = await getConversationDetail(chatId!);
      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "Erro ao carregar conversa");
      }
      return result.data;
    },
    enabled: Boolean(chatId) && (options?.enabled ?? true),
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  return {
    detail: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
