import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import { supabase } from "@/lib/supabase/client";
import {
  canPublishTypingPresence,
  conversationPresenceChannelName,
  isRemoteTypingVisible,
  parseTypingPresenceState,
  TYPING_PRESENCE_DEBOUNCE_MS,
  TYPING_PRESENCE_TTL_MS,
  type TypingPresencePayload,
} from "../utils/typingPresence";

export interface UseConversationTypingPresenceParams {
  conversationId: string | null;
  currentUserId: string | null;
  enabled?: boolean;
  /** When false, typing is disabled silently (Realtime down). */
  realtimeHealthy?: boolean;
}

export interface UseConversationTypingPresenceResult {
  isCounterpartyTyping: boolean;
  /** Wire to composer draft changes (has non-empty text). */
  notifyComposerDraftChange: (hasDraftText: boolean) => void;
}

/**
 * Ephemeral typing indicator via Supabase Realtime presence (Req. 5, R5-AC04, R27-AC04).
 */
export function useConversationTypingPresence({
  conversationId,
  currentUserId,
  enabled = true,
  realtimeHealthy = true,
}: UseConversationTypingPresenceParams): UseConversationTypingPresenceResult {
  const [lastRemoteTypingAt, setLastRemoteTypingAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const lastPublishAtRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTrackedTypingRef = useRef<boolean | null>(null);

  const isActive =
    enabled && Boolean(conversationId) && Boolean(currentUserId) && realtimeHealthy;

  const publishTypingRef = useRef<(typing: boolean) => Promise<void>>(async () => {});

  publishTypingRef.current = async (typing: boolean) => {
    const channel = channelRef.current;
    if (!channel || !currentUserId) return;

    const nowMs = Date.now();
    if (!canPublishTypingPresence(nowMs, lastPublishAtRef.current)) {
      metrics.count("cns_typing_events_throttled_total", 1, {
        conversation_id: conversationId ?? "unknown",
      });
      return;
    }

    if (lastTrackedTypingRef.current === typing) return;

    try {
      await channel.track({ user_id: currentUserId, typing } satisfies TypingPresencePayload);
      lastPublishAtRef.current = nowMs;
      lastTrackedTypingRef.current = typing;
    } catch (error) {
      logger.debug("chats_typing_presence_track_failed", {
        conversationId,
        typing,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const notifyComposerDraftChange = useCallback(
    (hasDraftText: boolean) => {
      if (!isActive) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (!hasDraftText) {
        void publishTypingRef.current(false);
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void publishTypingRef.current(true);
      }, TYPING_PRESENCE_DEBOUNCE_MS);
    },
    [isActive],
  );

  useEffect(() => {
    if (!isActive || !conversationId || !currentUserId) {
      channelRef.current = null;
      lastTrackedTypingRef.current = null;
      return;
    }

    const channelName = conversationPresenceChannelName(conversationId);
    const channel = supabase.channel(channelName, {
      config: { presence: { key: currentUserId } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<TypingPresencePayload>();
      const otherTyping = parseTypingPresenceState(state, currentUserId);
      if (otherTyping) {
        setLastRemoteTypingAt(Date.now());
      }
    });

    channelRef.current = channel;

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void publishTypingRef.current(false);
      }
    });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      void channel.untrack().catch(() => undefined);
      void supabase.removeChannel(channel);
      channelRef.current = null;
      lastTrackedTypingRef.current = null;
    };
  }, [conversationId, currentUserId, isActive]);

  useEffect(() => {
    if (!lastRemoteTypingAt) return;

    const tick = () => setNow(Date.now());
    const timerId = window.setInterval(tick, 500);
    return () => window.clearInterval(timerId);
  }, [lastRemoteTypingAt]);

  const isCounterpartyTyping = isRemoteTypingVisible(lastRemoteTypingAt, now, TYPING_PRESENCE_TTL_MS);

  return { isCounterpartyTyping, notifyComposerDraftChange };
}
