import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  CHAT_RESCHEDULE_TIMELINE_QUERY_KEY,
  SERVICE_RESCHEDULE_REQUEST_QUERY_KEY,
} from "@/features/service-reschedule";
import { CHAT_MESSAGES_QUERY_KEY } from "../constants/queryKeys";

export function useInvalidateChatRescheduleQueries(chatId: string | null) {
  const queryClient = useQueryClient();

  return useCallback(() => {
    if (!chatId) return;

    void queryClient.invalidateQueries({ queryKey: [CHAT_MESSAGES_QUERY_KEY, chatId] });
    void queryClient.invalidateQueries({ queryKey: [CHAT_RESCHEDULE_TIMELINE_QUERY_KEY, chatId] });
    void queryClient.invalidateQueries({ queryKey: [SERVICE_RESCHEDULE_REQUEST_QUERY_KEY] });
  }, [chatId, queryClient]);
}
