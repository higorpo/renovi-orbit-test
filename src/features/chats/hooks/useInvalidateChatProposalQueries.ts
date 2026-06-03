import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  CHAT_FREE_MESSAGING_QUERY_KEY,
  CHAT_MESSAGES_QUERY_KEY,
  CHAT_PROPOSAL_TIMELINE_QUERY_KEY
} from "../constants/queryKeys";

export function useInvalidateChatProposalQueries(chatId: string | null) {
  const queryClient = useQueryClient();

  return useCallback(() => {
    if (!chatId) return;

    void queryClient.invalidateQueries({ queryKey: [CHAT_MESSAGES_QUERY_KEY, chatId] });
    void queryClient.invalidateQueries({ queryKey: [CHAT_PROPOSAL_TIMELINE_QUERY_KEY, chatId] });
    void queryClient.invalidateQueries({ queryKey: [CHAT_FREE_MESSAGING_QUERY_KEY, chatId] });
  }, [chatId, queryClient]);
}
