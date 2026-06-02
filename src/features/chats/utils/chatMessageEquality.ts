import type { ChatMessageListItem } from "../types/chats.types";

function payloadSnapshot(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

/** True when list rendering can treat two rows as the same message content. */
export function areChatMessageListItemsEqual(
  a: ChatMessageListItem,
  b: ChatMessageListItem,
): boolean {
  return (
    a.id === b.id &&
    a.chat_id === b.chat_id &&
    a.sender_user_id === b.sender_user_id &&
    a.message_type === b.message_type &&
    a.delivery_status === b.delivery_status &&
    a.created_at === b.created_at &&
    a.updated_at === b.updated_at &&
    a.linked_entity_type === b.linked_entity_type &&
    a.linked_entity_id === b.linked_entity_id &&
    a.idempotency_key === b.idempotency_key &&
    payloadSnapshot(a.payload) === payloadSnapshot(b.payload)
  );
}
