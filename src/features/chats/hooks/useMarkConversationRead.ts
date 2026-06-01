import { useCallback, useEffect, useMemo, useRef } from "react";
import { markConversationRead } from "../api/chats.api";
import type { ChatMessageListItem } from "../types/chats.types";

const MARK_READ_DEBOUNCE_MS = 400;

function lastReadableMessageId(messages: readonly ChatMessageListItem[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message && !message.id.startsWith("optimistic:")) return message.id;
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
  const lastMarkedIdRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readableTailId = useMemo(() => lastReadableMessageId(messages), [messages]);

  const scheduleMarkRead = useCallback(
    (messageId: string | null) => {
      if (!chatId || !messageId) return;
      if (lastMarkedIdRef.current === messageId) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        if (lastMarkedIdRef.current === messageId) return;
        lastMarkedIdRef.current = messageId;
        void markConversationRead({ chatId, lastReadMessageId: messageId });
      }, MARK_READ_DEBOUNCE_MS);
    },
    [chatId],
  );

  useEffect(() => {
    scheduleMarkRead(readableTailId);
  }, [readableTailId, scheduleMarkRead]);

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
