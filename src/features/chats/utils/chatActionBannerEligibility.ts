import type { ChatMessageListItem, CnsMessageType } from "../types/chats.types";

export const CHAT_CLOSE_BANNER_INACTIVITY_MS = 12 * 60 * 60 * 1000;

const EXCHANGE_MESSAGE_TYPES = new Set<CnsMessageType>(["TEXT", "IMAGE"]);

function isExchangeMessage(message: ChatMessageListItem): boolean {
  if (message.id.startsWith("optimistic:")) return false;
  return EXCHANGE_MESSAGE_TYPES.has(message.message_type);
}

/**
 * Provider must have sent at least one user message and the client must have replied once after that.
 */
export function hasMinimumProviderClientExchange(
  messages: readonly ChatMessageListItem[],
  clientId: string,
  providerId: string,
): boolean {
  const exchangeMessages = messages
    .filter(isExchangeMessage)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const firstProviderMessage = exchangeMessages.find((message) => message.sender_user_id === providerId);
  if (!firstProviderMessage) return false;

  return exchangeMessages.some(
    (message) =>
      message.sender_user_id === clientId &&
      message.created_at > firstProviderMessage.created_at,
  );
}

export function isChatInactiveForCloseBanner(
  lastInteractionAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastInteractionAt) return false;

  const lastInteractionMs = new Date(lastInteractionAt).getTime();
  if (Number.isNaN(lastInteractionMs)) return false;

  return now.getTime() - lastInteractionMs >= CHAT_CLOSE_BANNER_INACTIVITY_MS;
}
