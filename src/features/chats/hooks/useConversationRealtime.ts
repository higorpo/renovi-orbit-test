import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import { supabase } from "@/lib/supabase/client";
import {
  CHAT_CONVERSATIONS_LIST_QUERY_KEY,
  CHAT_FREE_MESSAGING_QUERY_KEY,
  CHAT_PROPOSAL_TIMELINE_QUERY_KEY,
  CONVERSATION_DETAIL_QUERY_KEY,
} from "../constants/queryKeys";
import type { ConversationDetailResponse } from "../types/chats.types";
import { wasRecentlySentChatMessageId } from "../utils/chatMessageSendSync";
import { subscribeConversationChannel } from "../utils/conversationRealtimeChannel";

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

export interface UseConversationRealtimeOptions {
  enabled?: boolean;
  /** Required for proposal UPDATE events after provider_proposals.chat_id was removed. */
  serviceRequestId?: string | null;
  providerId?: string | null;
  /** Called after SUBSCRIBED or reconnected — wire to useChatMessages.refetchGapFill. */
  onReconcile?: () => void;
  /** Subscription status updates — wire to useConversationPollingFallback. */
  onRealtimeStatusChange?: (status: string) => void;
}

export function isRealtimeConnectionHealthy(status: string | null): boolean {
  return status === "SUBSCRIBED";
}

export function useConversationRealtime(
  chatId: string | null,
  options?: UseConversationRealtimeOptions & { currentUserId?: string | null },
) {
  const queryClient = useQueryClient();
  const seenEventsRef = useRef(new Set<string>());
  const lastStatusRef = useRef<string | null>(null);
  const onReconcileRef = useRef(options?.onReconcile);
  const onRealtimeStatusChangeRef = useRef(options?.onRealtimeStatusChange);
  onReconcileRef.current = options?.onReconcile;
  onRealtimeStatusChangeRef.current = options?.onRealtimeStatusChange;
  const enabled = Boolean(chatId) && (options?.enabled ?? true);
  const currentUserId = options?.currentUserId ?? null;
  const serviceRequestId = options?.serviceRequestId ?? null;
  const providerId = options?.providerId ?? null;

  useEffect(() => {
    if (!enabled || !chatId) return;

    seenEventsRef.current.clear();

    const patchDetailReadReceipt = (
      lastReadAt: string,
      lastReadMessageId: string | null,
    ) => {
      queryClient.setQueryData<ConversationDetailResponse>(
        [CONVERSATION_DETAIL_QUERY_KEY, chatId],
        (current) => {
          if (!current) return current;
          return {
            ...current,
            counterparty_read_receipt: {
              last_read_at: lastReadAt,
              last_read_message_id: lastReadMessageId,
            },
          };
        },
      );
    };

    const invalidateProposal = () => {
      void queryClient.invalidateQueries({ queryKey: [CHAT_PROPOSAL_TIMELINE_QUERY_KEY, chatId] });
      void queryClient.invalidateQueries({ queryKey: [CHAT_FREE_MESSAGING_QUERY_KEY, chatId] });
    };

    const invalidateInbox = () => {
      void queryClient.invalidateQueries({ queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY] });
    };

    const channel = subscribeConversationChannel(
      supabase,
      chatId,
      {
        onMessageInsert: ({ id }) => {
          const key = `chat_messages:INSERT:${id}`;
          if (!rememberEvent(seenEventsRef.current, key)) return;

          // Own send: onSuccess already merged the message + refreshed inbox.
          if (wasRecentlySentChatMessageId(id)) return;

          onReconcileRef.current?.();
          invalidateInbox();
        },
        onProposalUpdate: ({ id }) => {
          const key = `provider_proposals:UPDATE:${id}`;
          if (!rememberEvent(seenEventsRef.current, key)) return;
          invalidateProposal();
          onReconcileRef.current?.();
        },
        onReadReceiptChange: ({ userId, lastReadMessageId, lastReadAt }) => {
          if (!currentUserId || userId === currentUserId) return;

          const key = `chat_read_receipts:${userId}:${lastReadMessageId ?? "none"}:${lastReadAt}`;
          if (!rememberEvent(seenEventsRef.current, key)) return;
          patchDetailReadReceipt(lastReadAt, lastReadMessageId);
        },
        onStatusChange: (status) => {
          metrics.count("chats.realtime_subscription_status", 1, { status });
          logger.debug("chats_realtime_status", { chatId, status });
          onRealtimeStatusChangeRef.current?.(status);

          const wasDisconnected =
            lastStatusRef.current === "CHANNEL_ERROR" ||
            lastStatusRef.current === "TIMED_OUT" ||
            lastStatusRef.current === "CLOSED";
          const isSubscribed = status === "SUBSCRIBED";

          if (isSubscribed && (wasDisconnected || lastStatusRef.current === null)) {
            onReconcileRef.current?.();
          }

          lastStatusRef.current = status;
        },
      },
      { serviceRequestId, providerId },
    );

    return () => {
      lastStatusRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [chatId, currentUserId, enabled, providerId, queryClient, serviceRequestId]);
}
