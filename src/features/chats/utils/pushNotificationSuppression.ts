import { extractChatIdFromPushPayload } from "@/lib/pushCollapseKey";
import type { PushNotificationPayload } from "@/lib/push";

export { extractChatIdFromPushPayload };

export function isWebTabVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

export function shouldSuppressChatPushNotification(params: {
  activeConversationId: string | null;
  payload: PushNotificationPayload;
  appInForeground: boolean;
  webTabVisible?: boolean;
}): boolean {
  const webTabVisible = params.webTabVisible ?? isWebTabVisible();

  if (!params.appInForeground) return false;
  if (!webTabVisible) return false;

  const chatId = extractChatIdFromPushPayload(params.payload);
  if (!chatId || !params.activeConversationId) return false;

  return chatId === params.activeConversationId;
}
