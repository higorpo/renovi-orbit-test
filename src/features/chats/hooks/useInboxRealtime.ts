import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "@/features/auth";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import { subscribeInboxRealtime, removeRealtimeChannel, type InboxMessageInsertPayload } from "../api/realtime.api";
import { CHAT_CONVERSATIONS_LIST_QUERY_KEY } from "../constants/queryKeys";
import { wasRecentlySentChatMessageId } from "../utils/chatMessageSendSync";
import { patchConversationListCache } from "../utils/patchConversationListCache";

const DEDUPE_CACHE_LIMIT = 512;

function rememberEvent(seen: Set<string>, key: string): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  if (seen.size > DEDUPE_CACHE_LIMIT) {
    const oldest = seen.values().next().value;
    if (oldest) seen.delete(oldest);
  }
  return true;
}

export interface UseInboxRealtimeOptions {
  enabled?: boolean;
}

/** Keeps the inbox list fresh while ChatsLayout is mounted (design §5.4). */
export function useInboxRealtime(options?: UseInboxRealtimeOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const seenEventsRef = useRef(new Set<string>());
  const lastStatusRef = useRef<string | null>(null);
  const enabled = Boolean(user?.id) && (options?.enabled ?? true);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!enabled || !userId) return;

    seenEventsRef.current.clear();

    const refreshInbox = () => {
      void queryClient.refetchQueries({
        queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY],
        type: "active",
      });
    };

    const handleMessageInsert = (message: InboxMessageInsertPayload) => {
      if (wasRecentlySentChatMessageId(message.id)) return;

      const key = `chat_messages:INSERT:${message.id}`;
      if (!rememberEvent(seenEventsRef.current, key)) return;

      const isCounterparty = message.senderUserId !== userId;
      const patched = patchConversationListCache(queryClient, {
        chatId: message.chatId,
        lastInteractionAt: message.createdAt,
        lastMessage: {
          id: message.id,
          messageType: message.messageType,
          createdAt: message.createdAt,
          payload: message.payload,
          linkedEntityType: message.linkedEntityType,
          linkedEntityId: message.linkedEntityId,
        },
        markAsUnread: isCounterparty,
      });

      if (!patched) {
        refreshInbox();
      }
    };

    const channel = subscribeInboxRealtime(userId, {
      onMessageInsert: handleMessageInsert,
      onStatusChange: (status) => {
        metrics.count("chats.inbox_realtime_subscription_status", 1, { status });
        logger.debug("chats_inbox_realtime_status", { userId, status });

        const wasDisconnected =
          lastStatusRef.current === "CHANNEL_ERROR" ||
          lastStatusRef.current === "TIMED_OUT" ||
          lastStatusRef.current === "CLOSED";
        const isSubscribed = status === "SUBSCRIBED";

        if (isSubscribed && (wasDisconnected || lastStatusRef.current === null)) {
          refreshInbox();
        }

        lastStatusRef.current = status;
      },
    });

    return () => {
      lastStatusRef.current = null;
      removeRealtimeChannel(channel);
    };
  }, [enabled, queryClient, userId]);
}
