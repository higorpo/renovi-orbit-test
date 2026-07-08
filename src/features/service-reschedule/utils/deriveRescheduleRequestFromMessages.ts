import type { ChatMessageListItem } from "@/features/chats";

export function deriveLatestRescheduleRequestIdFromMessages(
  messages: readonly ChatMessageListItem[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.linked_entity_type !== "workflow" || !message.linked_entity_id) {
      continue;
    }

    if (message.message_type === "WORKFLOW_ACTION") {
      const actionKey = message.payload?.action_key;
      if (actionKey === "service_reschedule_proposed") {
        return message.linked_entity_id;
      }
    }

    if (message.message_type === "SYSTEM") {
      const text = message.payload?.text;
      if (typeof text === "string" && text.toLowerCase().includes("reagendamento")) {
        return message.linked_entity_id;
      }
    }
  }

  return null;
}
