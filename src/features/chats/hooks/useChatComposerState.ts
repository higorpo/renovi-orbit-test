import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { checkChatFreeMessagingAllowed } from "../api/chats.api";
import {
  CHAT_FREE_MESSAGING_QUERY_KEY,
  CHAT_PROPOSAL_TIMELINE_QUERY_KEY,
} from "../constants/queryKeys";
import type { CnsConversationStatus } from "../types/chats.types";
import { deriveChatComposerState } from "../utils/composerState";

export interface UseChatComposerStateParams {
  chatId: string | null;
  conversationStatus: CnsConversationStatus | null;
  enabled?: boolean;
}

/**
 * Proposal-gated composer (Req. 34, R18-AC06/07) — mirrors cns_chat_free_messaging_allowed.
 */
export function useChatComposerState({
  chatId,
  conversationStatus,
  enabled = true,
}: UseChatComposerStateParams) {
  const query = useQuery({
    queryKey: [CHAT_FREE_MESSAGING_QUERY_KEY, chatId],
    queryFn: async () => {
      const result = await checkChatFreeMessagingAllowed(chatId!);
      if (result.error || result.data === null) {
        throw new Error(result.error?.message ?? "Erro ao verificar envio de mensagens");
      }
      return result.data;
    },
    enabled: Boolean(chatId) && enabled,
    staleTime: 30_000,
  });

  const composerState = useMemo(
    () =>
      deriveChatComposerState({
        freeMessagingAllowed: query.data,
        conversationStatus,
        isLoading: query.isLoading && query.data === undefined,
      }),
    [conversationStatus, query.data, query.isLoading],
  );

  return {
    ...composerState,
    freeMessagingAllowed: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    /** Query key root invalidated when proposal Realtime events fire. */
    proposalTimelineQueryKey: chatId ? [CHAT_PROPOSAL_TIMELINE_QUERY_KEY, chatId] : null,
  };
}
