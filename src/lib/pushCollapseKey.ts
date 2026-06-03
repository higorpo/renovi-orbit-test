import type { PushNotificationPayload } from './push'

/** Stable key so Android/Web replace notifications per conversation (not per message). */
export function extractChatIdFromPushPayload(payload: PushNotificationPayload): string | null {
  const data = payload.data
  if (!data) return null

  const direct = data.chat_id ?? data.conversation_id ?? data.chatId
  if (direct?.trim()) return direct.trim()

  const deepLink = data.deep_link_path?.trim()
  if (!deepLink) return null

  const match = deepLink.match(/(?:^|\/)chats\/([^/?#]+)/)
  return match?.[1] ?? null
}

export function pushNotificationCollapseKey(
  payload: PushNotificationPayload,
  fallback: string,
): string {
  const chatId = extractChatIdFromPushPayload(payload)
  if (chatId) return chatId

  const dispatchId = payload.data?.dispatch_id?.trim()
  if (dispatchId) return dispatchId

  const tag = payload.data?.tag?.trim()
  if (tag) return tag

  return fallback
}
