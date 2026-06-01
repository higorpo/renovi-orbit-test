import type { ChatMessageListItem, SendMessageResultMessage } from "../types/chats.types";

export function sendMessageResultToListItem(message: SendMessageResultMessage): ChatMessageListItem {
  return {
    id: message.id,
    chat_id: message.chat_id,
    sender_user_id: message.sender_user_id,
    message_type: message.message_type,
    payload: message.payload,
    linked_entity_type: null,
    linked_entity_id: null,
    idempotency_key: message.idempotency_key,
    delivery_status: "SENT",
    created_at: message.created_at,
    updated_at: message.created_at,
  };
}
