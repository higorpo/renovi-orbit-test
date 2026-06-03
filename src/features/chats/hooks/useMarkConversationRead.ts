import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { markConversationRead } from "../api/chats.api";
import { CHAT_CONVERSATIONS_LIST_QUERY_KEY } from "../constants/queryKeys";
import type { ChatMessageListItem } from "../types/chats.types";
import { clearConversationUnreadInListCache } from "../utils/patchConversationListCache";

const MARK_READ_DEBOUNCE_MS = 400;

function lastReadableMessage(
  messages: readonly ChatMessageListItem[],
): { id: string; createdAt: string } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message && !message.id.startsWith("optimistic:")) {
      return { id: message.id, createdAt: message.created_at };
    }
  }
  return null;
}

/**
 * Marks the conversation read only for confirmed server message ids (never optimistic rows).
 * Debounces rapid timeline updates so mark_read runs after message/inbox refetches settle.
 */
export function useMarkConversationRead(
  chatId: string | null,
  messages: readonly ChatMessageListItem[],
) {
  const queryClient = useQueryClient();
  const lastMarkedIdRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readableTail = useMemo(() => lastReadableMessage(messages), [messages]);

  const scheduleMarkRead = useCallback(
    (tail: { id: string; createdAt: string } | null) => {
      if (!chatId || !tail) return;
      if (lastMarkedIdRef.current === tail.id) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        if (lastMarkedIdRef.current === tail.id) return;
        lastMarkedIdRef.current = tail.id;

        clearConversationUnreadInListCache(queryClient, {
          chatId,
          lastReadAt: tail.createdAt,
        });

        void markConversationRead({ chatId, lastReadMessageId: tail.id }).then((result) => {
          if (result.error) {
            void queryClient.invalidateQueries({ queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY] });
          }
        });
      }, MARK_READ_DEBOUNCE_MS);
    },
    [chatId, queryClient],
  );

  useEffect(() => {
    scheduleMarkRead(readableTail);
  }, [readableTail, scheduleMarkRead]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [chatId]);

  useEffect(() => {
    lastMarkedIdRef.current = null;
  }, [chatId]);

  return { scheduleMarkRead };
}
