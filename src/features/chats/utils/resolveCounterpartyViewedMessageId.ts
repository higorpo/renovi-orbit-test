import type { ChatMessageListItem, CounterpartyReadReceipt } from "../types/chats.types";

function isServerMessageId(id: string): boolean {
  return !id.startsWith("optimistic:");
}

function isAtOrBeforeMessage(
  message: ChatMessageListItem,
  cursor: ChatMessageListItem,
): boolean {
  if (message.created_at < cursor.created_at) return true;
  if (message.created_at > cursor.created_at) return false;
  return message.id <= cursor.id;
}

function resolveReadCursorMessage(
  messages: readonly ChatMessageListItem[],
  receipt: CounterpartyReadReceipt,
): ChatMessageListItem | null {
  if (receipt.last_read_message_id) {
    const byId = messages.find((m) => m.id === receipt.last_read_message_id);
    if (byId) return byId;
  }

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message && message.created_at <= receipt.last_read_at) return message;
  }

  return null;
}

/**
 * Message id below which to show "Visualizado": last outgoing message the counterparty has read.
 */
export function resolveCounterpartyViewedMessageId(
  messages: readonly ChatMessageListItem[],
  currentUserId: string | null,
  receipt: CounterpartyReadReceipt | null | undefined,
): string | null {
  if (!currentUserId || !receipt || messages.length === 0) return null;

  const readCursor = resolveReadCursorMessage(messages, receipt);
  if (!readCursor) return null;

  let lastViewedOutgoingId: string | null = null;

  for (const message of messages) {
    if (
      !isServerMessageId(message.id) ||
      message.sender_user_id !== currentUserId ||
      !isAtOrBeforeMessage(message, readCursor)
    ) {
      continue;
    }
    lastViewedOutgoingId = message.id;
  }

  return lastViewedOutgoingId;
}
