import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";

/** Design §9.3 — fallback when Realtime is down (R30-AC01). */
export const CHAT_POLLING_FALLBACK_INTERVAL_MS = 15_000;

/** OAC-15 — stable polling must not run faster than 5s. */
export const CHAT_POLLING_MIN_INTERVAL_MS = 5_000;

export interface UseConversationPollingFallbackParams {
  chatId: string | null;
  /** When true, polling is disabled (Realtime SUBSCRIBED). */
  realtimeHealthy: boolean;
  /** Typically refetchGapFill + message query invalidation for the open chat only. */
  onPoll: () => void | Promise<void>;
  enabled?: boolean;
  intervalMs?: number;
}

/**
 * Polls only the open conversation when Realtime is unhealthy; never polls the global inbox.
 */
export function useConversationPollingFallback({
  chatId,
  realtimeHealthy,
  onPoll,
  enabled = true,
  intervalMs = CHAT_POLLING_FALLBACK_INTERVAL_MS,
}: UseConversationPollingFallbackParams): void {
  const onPollRef = useRef(onPoll);
  onPollRef.current = onPoll;

  const effectiveInterval = Math.max(intervalMs, CHAT_POLLING_MIN_INTERVAL_MS);

  useEffect(() => {
    if (!enabled || !chatId || realtimeHealthy) return;

    let cancelled = false;

    const runPoll = () => {
      if (cancelled) return;
      metrics.count("chats.polling_fallback_tick", 1, { chat_id: chatId });
      logger.debug("chats_polling_fallback_tick", { chatId });
      void onPollRef.current();
    };

    runPoll();
    const timerId = window.setInterval(runPoll, effectiveInterval);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [chatId, enabled, effectiveInterval, realtimeHealthy]);
}
