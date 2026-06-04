import { moderateTextWithRecentMessages } from "@/lib/contentModeration";
import type { ContentModerationResult } from "@/lib/contentModeration";
import type { ChatMessageListItem } from "../types/chats.types";
import { getChatMessageText } from "./getChatMessageText";

const RECENT_USER_MESSAGE_LIMIT = 10;

export function collectRecentUserTextMessages(
  messages: ChatMessageListItem[],
  userId: string,
  limit = RECENT_USER_MESSAGE_LIMIT,
): string[] {
  return messages
    .filter(
      (message) =>
        message.sender_user_id === userId &&
        message.message_type === "TEXT",
    )
    .sort(
      (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
    )
    .slice(-limit)
    .map((message) => getChatMessageText(message))
    .filter((text) => text.trim().length > 0);
}

export function moderateChatComposerSend(params: {
  text: string;
  messages: ChatMessageListItem[];
  userId: string | null;
}): ContentModerationResult {
  const trimmed = params.text.trim();
  if (!trimmed) {
    return { allowed: true, violation: null, message: null };
  }

  const recentMessages =
    params.userId != null
      ? collectRecentUserTextMessages(params.messages, params.userId)
      : [];

  return moderateTextWithRecentMessages(trimmed, recentMessages);
}
