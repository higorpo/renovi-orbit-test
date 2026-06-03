import type { ChatMessageListItem } from "../types/chats.types";

export function deriveLatestProposalIdFromMessages(
  messages: readonly ChatMessageListItem[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.message_type !== "PROPOSAL") continue;
    if (message.linked_entity_id) return message.linked_entity_id;
  }
  return null;
}
