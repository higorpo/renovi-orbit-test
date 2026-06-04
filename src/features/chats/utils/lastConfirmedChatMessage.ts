import type { ChatMessageListItem } from "../types/chats.types";

/** Last timeline row backed by the server (skips optimistic send placeholders). */
export function lastConfirmedChatMessage(
  messages: readonly ChatMessageListItem[],
): ChatMessageListItem | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message && !message.id.startsWith("optimistic:")) {
      return message;
    }
  }
  return null;
}
