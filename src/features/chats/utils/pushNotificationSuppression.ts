import type { PushNotificationPayload } from "@/lib/push";

export function extractChatIdFromPushPayload(payload: PushNotificationPayload): string | null {
  const data = payload.data;
  if (!data) return null;

  const direct = data.chat_id ?? data.conversation_id ?? data.chatId;
  if (direct) return direct;

  const deepLink = data.deep_link_path?.trim();
  if (!deepLink) return null;

  const match = deepLink.match(/(?:^|\/)chats\/([^/?#]+)/);
  return match?.[1] ?? null;
}

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
