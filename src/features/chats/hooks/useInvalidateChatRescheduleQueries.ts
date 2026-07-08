import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  CHAT_ACTIVE_RESCHEDULE_QUERY_KEY,
  CHAT_RESCHEDULE_TIMELINE_QUERY_KEY,
  SERVICE_RESCHEDULE_REQUEST_QUERY_KEY,
} from "@/features/service-reschedule";

/**
 * Refreshes only the reschedule dynamic-card / active-request hydration caches.
 * Does not touch chat message list / inbox queries (same boundary as proposal cards).
 */
export function useInvalidateChatRescheduleQueries(chatId: string | null) {
  const queryClient = useQueryClient();

  return useCallback(() => {
    if (!chatId) return;

    void queryClient.invalidateQueries({
      queryKey: [CHAT_RESCHEDULE_TIMELINE_QUERY_KEY, chatId],
    });
    void queryClient.invalidateQueries({
      queryKey: [CHAT_ACTIVE_RESCHEDULE_QUERY_KEY, chatId],
    });
    void queryClient.invalidateQueries({
      queryKey: [SERVICE_RESCHEDULE_REQUEST_QUERY_KEY],
    });
  }, [chatId, queryClient]);
}
