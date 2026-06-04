import type { CreateProviderProposalResult } from "@/features/negotiation-proposals";
import type { ChatMessageListItem, CnsMessageType } from "../types/chats.types";

export function proposalTimelineMessageToListItem(
  timelineMessage: NonNullable<CreateProviderProposalResult["timeline_message"]>,
  senderUserId: string,
  proposalVersion: number,
): ChatMessageListItem {
  const createdAt = timelineMessage.created_at;
  return {
    id: timelineMessage.id,
    chat_id: timelineMessage.chat_id,
    sender_user_id: senderUserId,
    message_type: timelineMessage.message_type as CnsMessageType,
    payload: {
      proposal_id: timelineMessage.linked_entity_id,
      version: proposalVersion,
    },
    linked_entity_type: timelineMessage.linked_entity_type,
    linked_entity_id: timelineMessage.linked_entity_id,
    idempotency_key: timelineMessage.id,
    delivery_status: "SENT",
    created_at: createdAt,
    updated_at: createdAt,
  };
}
