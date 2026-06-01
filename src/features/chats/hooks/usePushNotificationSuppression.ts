import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import type { PushNotificationPayload } from "@/lib/push";
import { setPushSuppressionChecker } from "@/lib/pushSuppression";
import { metrics } from "@/lib/sentry";
import {
  extractChatIdFromPushPayload,
  isWebTabVisible,
  shouldSuppressChatPushNotification,
} from "../utils/pushNotificationSuppression";

/**
 * Suppresses foreground push banners when the user is viewing the same chat (R12-AC07).
 * Wire from ChatScreen with the open conversation id; integrates with lib/push handlers.
 */
export function usePushNotificationSuppression(activeConversationId: string | null): void {
  const appInForegroundRef = useRef(true);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | undefined;

    void App.addListener("appStateChange", ({ isActive }) => {
      appInForegroundRef.current = isActive;
    }).then((handle) => {
      removeListener = () => handle.remove();
    });

    return () => {
      removeListener?.();
    };
  }, []);

  useEffect(() => {
    const checker = (payload: PushNotificationPayload): boolean => {
      const suppress = shouldSuppressChatPushNotification({
        activeConversationId,
        payload,
        appInForeground: appInForegroundRef.current,
        webTabVisible: isWebTabVisible(),
      });

      if (suppress) {
        logger.debug("chats_push_notification_suppressed", {
          chatId: extractChatIdFromPushPayload(payload),
        });
        metrics.count("chats.push_suppressed", 1);
      }

      return suppress;
    };

    setPushSuppressionChecker(checker);
    return () => setPushSuppressionChecker(null);
  }, [activeConversationId]);
}
