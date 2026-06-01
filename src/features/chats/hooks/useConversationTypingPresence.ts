import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase/client";
import {
  canPublishTypingPresence,
  conversationPresenceChannelName,
  isRemoteTypingVisible,
  parseTypingPresenceState,
  TYPING_ACTIVITY_IDLE_MS,
  TYPING_PRESENCE_PUBLISH_INTERVAL_MS,
  TYPING_PRESENCE_TTL_MS,
  type TypingPresencePayload,
} from "../utils/typingPresence";

/** Brief false in presence sync must not hide an active remote session. */
const REMOTE_TYPING_CLEAR_DEBOUNCE_MS = 400;
const PRESENCE_RECONNECT_DELAY_MS = 1_000;

export interface UseConversationTypingPresenceParams {
  conversationId: string | null;
  currentUserId: string | null;
  enabled?: boolean;
}

export interface UseConversationTypingPresenceResult {
  isCounterpartyTyping: boolean;
  /** Call on every composer value change (keystroke, paste, delete, etc.). */
  notifyComposerChange: () => void;
  /** Call when sending or leaving — publishes typing:false immediately. */
  notifyTypingStopNow: () => void;
}

/**
 * Typing indicator via Realtime presence (Req. 5, R5-AC04, R27-AC04).
 *
 * Local: field change → typing:true; 2s idle → typing:false; change again → true.
 * While typing, re-publishes true every 2s (design throttle + remote TTL).
 */
export function useConversationTypingPresence({
  conversationId,
  currentUserId,
  enabled = true,
}: UseConversationTypingPresenceParams): UseConversationTypingPresenceResult {
  const [lastRemoteTypingAt, setLastRemoteTypingAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const readyRef = useRef(false);
  const isTypingRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepAliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remoteClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPublishAtRef = useRef<number | null>(null);
  const effectActiveRef = useRef(false);

  const conversationIdRef = useRef(conversationId);
  const currentUserIdRef = useRef(currentUserId);
  conversationIdRef.current = conversationId;
  currentUserIdRef.current = currentUserId;

  const isConfigured = enabled && Boolean(conversationId) && Boolean(currentUserId);

  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  const clearRemoteClearTimer = useCallback(() => {
    if (remoteClearTimerRef.current) {
      clearTimeout(remoteClearTimerRef.current);
      remoteClearTimerRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
  }, []);

  const publishTypingRef = useRef<(typing: boolean) => void>(() => {});

  publishTypingRef.current = (typing: boolean) => {
    const channel = channelRef.current;
    const userId = currentUserIdRef.current;
    if (!channel || !readyRef.current || !userId) return;

    const at = Date.now();
    if (
      !canPublishTypingPresence(at, lastPublishAtRef.current, {
        bypassInterval: !typing,
      })
    ) {
      return;
    }

    lastPublishAtRef.current = typing ? at : null;

    void channel
      .track({
        user_id: userId,
        typing,
        at,
      } satisfies TypingPresencePayload)
      .catch((error) => {
        logger.debug("chats_typing_presence_track_failed", {
          conversationId: conversationIdRef.current,
          typing,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  };

  const startKeepAlive = useCallback(() => {
    stopKeepAlive();
    keepAliveTimerRef.current = setInterval(() => {
      if (!isTypingRef.current) return;
      publishTypingRef.current(true);
    }, TYPING_PRESENCE_PUBLISH_INTERVAL_MS);
  }, [stopKeepAlive]);

  const scheduleTypingStopRef = useRef<() => void>(() => {});

  scheduleTypingStopRef.current = () => {
    clearStopTimer();
    stopTimerRef.current = setTimeout(() => {
      stopTimerRef.current = null;
      if (!isTypingRef.current) return;
      isTypingRef.current = false;
      stopKeepAlive();
      publishTypingRef.current(false);
    }, TYPING_ACTIVITY_IDLE_MS);
  };

  const beginTypingSession = useCallback(() => {
    isTypingRef.current = true;
    publishTypingRef.current(true);
    startKeepAlive();
    scheduleTypingStopRef.current();
  }, [startKeepAlive, clearStopTimer]);

  const notifyComposerChange = useCallback(() => {
    if (!isConfigured) return;

    if (!isTypingRef.current) {
      beginTypingSession();
      return;
    }

    scheduleTypingStopRef.current();
    publishTypingRef.current(true);
  }, [isConfigured, beginTypingSession]);

  const notifyTypingStopNow = useCallback(() => {
    if (!isConfigured) return;

    clearStopTimer();
    stopKeepAlive();
    if (!isTypingRef.current) return;

    isTypingRef.current = false;
    lastPublishAtRef.current = null;
    publishTypingRef.current(false);
  }, [isConfigured, clearStopTimer, stopKeepAlive]);

  const applyRemoteTypingRef = useRef<(otherTyping: boolean) => void>(() => {});

  applyRemoteTypingRef.current = (otherTyping: boolean) => {
    if (otherTyping) {
      clearRemoteClearTimer();
      setLastRemoteTypingAt(Date.now());
      return;
    }

    clearRemoteClearTimer();
    remoteClearTimerRef.current = setTimeout(() => {
      remoteClearTimerRef.current = null;
      setLastRemoteTypingAt(null);
    }, REMOTE_TYPING_CLEAR_DEBOUNCE_MS);
  };

  const syncRemoteTypingRef = useRef<(channel: ReturnType<typeof supabase.channel>) => void>(() => {});

  syncRemoteTypingRef.current = (channel) => {
    const userId = currentUserIdRef.current;
    if (!userId) return;

    const otherTyping = parseTypingPresenceState(
      channel.presenceState<TypingPresencePayload>(),
      userId,
    );

    applyRemoteTypingRef.current(otherTyping);
  };

  const resumeLocalTypingIfNeededRef = useRef<() => void>(() => {});

  resumeLocalTypingIfNeededRef.current = () => {
    if (!isTypingRef.current) return;
    publishTypingRef.current(true);
    startKeepAlive();
    scheduleTypingStopRef.current();
  };

  useEffect(() => {
    if (!isConfigured || !conversationId || !currentUserId) {
      effectActiveRef.current = false;
      readyRef.current = false;
      isTypingRef.current = false;
      clearStopTimer();
      clearRemoteClearTimer();
      clearReconnectTimer();
      stopKeepAlive();
      channelRef.current = null;
      return;
    }

    effectActiveRef.current = true;

    const teardownChannel = (channel: ReturnType<typeof supabase.channel>) => {
      void channel.untrack().catch(() => undefined);
      void supabase.removeChannel(channel);
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };

    const connect = () => {
      if (!effectActiveRef.current) return;

      const channelName = conversationPresenceChannelName(conversationId);
      const channel = supabase.channel(channelName, {
        config: { presence: { key: currentUserId } },
      });

      const onPresenceChange = () => syncRemoteTypingRef.current(channel);

      channel.on("presence", { event: "sync" }, onPresenceChange);
      channel.on("presence", { event: "join" }, onPresenceChange);
      channel.on("presence", { event: "leave" }, onPresenceChange);

      channelRef.current = channel;

      channel.subscribe((status) => {
        if (!effectActiveRef.current || channelRef.current !== channel) return;

        if (status === "SUBSCRIBED") {
          readyRef.current = true;
          clearReconnectTimer();
          syncRemoteTypingRef.current(channel);
          resumeLocalTypingIfNeededRef.current();
          return;
        }

        if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          logger.debug("chats_typing_presence_channel_dropped", {
            conversationId,
            status,
          });

          readyRef.current = false;
          stopKeepAlive();

          if (!effectActiveRef.current) return;

          clearReconnectTimer();
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            if (!effectActiveRef.current || channelRef.current !== channel) return;
            teardownChannel(channel);
            connect();
          }, PRESENCE_RECONNECT_DELAY_MS);
        }
      });
    };

    connect();

    return () => {
      effectActiveRef.current = false;
      readyRef.current = false;
      isTypingRef.current = false;
      clearStopTimer();
      clearRemoteClearTimer();
      clearReconnectTimer();
      stopKeepAlive();

      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) {
        teardownChannel(channel);
      }
    };
  }, [
    clearReconnectTimer,
    clearRemoteClearTimer,
    clearStopTimer,
    conversationId,
    currentUserId,
    isConfigured,
    stopKeepAlive,
  ]);

  useEffect(() => {
    if (!lastRemoteTypingAt) return;

    const timerId = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timerId);
  }, [lastRemoteTypingAt]);

  const isCounterpartyTyping = isRemoteTypingVisible(lastRemoteTypingAt, now, TYPING_PRESENCE_TTL_MS);

  return { isCounterpartyTyping, notifyComposerChange, notifyTypingStopNow };
};
