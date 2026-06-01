import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import { supabase } from "@/lib/supabase/client";
import {
  CHAT_CONVERSATIONS_LIST_QUERY_KEY,
  CHAT_FREE_MESSAGING_QUERY_KEY,
  CHAT_MESSAGES_QUERY_KEY,
  CHAT_PROPOSAL_TIMELINE_QUERY_KEY,
  CONVERSATION_DETAIL_QUERY_KEY,
} from "../constants/queryKeys";
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
  options?: UseConversationRealtimeOptions,
) {
  const queryClient = useQueryClient();
  const seenEventsRef = useRef(new Set<string>());
  const lastStatusRef = useRef<string | null>(null);
  const enabled = Boolean(chatId) && (options?.enabled ?? true);

  useEffect(() => {
    if (!enabled || !chatId) return;

    seenEventsRef.current.clear();

    const invalidateMessages = () => {
      void queryClient.invalidateQueries({ queryKey: [CHAT_MESSAGES_QUERY_KEY, chatId] });
    };

    const invalidateProposal = () => {
      void queryClient.invalidateQueries({ queryKey: [CHAT_PROPOSAL_TIMELINE_QUERY_KEY, chatId] });
      void queryClient.invalidateQueries({ queryKey: [CHAT_FREE_MESSAGING_QUERY_KEY, chatId] });
    };

    const invalidateInbox = () => {
      void queryClient.invalidateQueries({ queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [CONVERSATION_DETAIL_QUERY_KEY, chatId] });
    };

    const channel = subscribeConversationChannel(supabase, chatId, {
      onMessageInsert: ({ id }) => {
        const key = `chat_messages:INSERT:${id}`;
        if (!rememberEvent(seenEventsRef.current, key)) return;
        invalidateMessages();
        invalidateInbox();
      },
      onProposalUpdate: ({ id }) => {
        const key = `provider_proposals:UPDATE:${id}`;
        if (!rememberEvent(seenEventsRef.current, key)) return;
        invalidateProposal();
        invalidateMessages();
      },
      onStatusChange: (status) => {
        metrics.count("chats.realtime_subscription_status", 1, { status });
        logger.debug("chats_realtime_status", { chatId, status });
        options?.onRealtimeStatusChange?.(status);

        const wasDisconnected =
          lastStatusRef.current === "CHANNEL_ERROR" ||
          lastStatusRef.current === "TIMED_OUT" ||
          lastStatusRef.current === "CLOSED";
        const isSubscribed = status === "SUBSCRIBED";

        if (isSubscribed && (wasDisconnected || lastStatusRef.current === null)) {
          options?.onReconcile?.();
        }

        lastStatusRef.current = status;
      },
    });

    return () => {
      lastStatusRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [chatId, enabled, options?.onReconcile, queryClient]);
}
