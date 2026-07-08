import type { ChatMessageListItem } from "@/features/chats";

export const SERVICE_RESCHEDULE_PROPOSED_ACTION_KEY = "service_reschedule_proposed";

export function isServiceRescheduleProposedWorkflowMessage(
  message: Pick<
    ChatMessageListItem,
    "message_type" | "payload" | "linked_entity_type" | "linked_entity_id"
  >,
): boolean {
  if (message.message_type !== "WORKFLOW_ACTION") return false;
  if (message.linked_entity_type !== "workflow" || !message.linked_entity_id) return false;

  const actionKey = message.payload?.action_key;
  if (actionKey === SERVICE_RESCHEDULE_PROPOSED_ACTION_KEY) return true;

  const text = message.payload?.text;
  return typeof text === "string" && text.startsWith("Nova data proposta:");
}

export function deriveLatestRescheduleRequestIdFromMessages(
  messages: readonly ChatMessageListItem[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.linked_entity_type !== "workflow" || !message.linked_entity_id) {
      continue;
    }

    if (isServiceRescheduleProposedWorkflowMessage(message)) {
      return message.linked_entity_id;
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
