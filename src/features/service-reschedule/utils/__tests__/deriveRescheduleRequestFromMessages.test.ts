import { describe, expect, it } from "vitest";
import {
  deriveLatestRescheduleRequestIdFromMessages,
  isServiceRescheduleProposedWorkflowMessage,
} from "../deriveRescheduleRequestFromMessages";
import type { ChatMessageListItem } from "@/features/chats/types/chats.types";

function buildMessage(
  partial: Partial<ChatMessageListItem> & Pick<ChatMessageListItem, "message_type">,
): ChatMessageListItem {
  return {
    id: partial.id ?? "msg-1",
    chat_id: partial.chat_id ?? "chat-1",
    sender_user_id: partial.sender_user_id ?? null,
    message_type: partial.message_type,
    payload: partial.payload ?? {},
    linked_entity_type: partial.linked_entity_type ?? null,
    linked_entity_id: partial.linked_entity_id ?? null,
    created_at: partial.created_at ?? "2026-07-01T12:00:00.000Z",
    delivery_status: partial.delivery_status ?? "DELIVERED",
    client_send_id: partial.client_send_id ?? null,
    proposal_version: partial.proposal_version ?? null,
  };
}

describe("deriveLatestRescheduleRequestIdFromMessages", () => {
  it("returns latest workflow reschedule request id", () => {
    const messages = [
      buildMessage({
        id: "m1",
        message_type: "SYSTEM",
        linked_entity_type: "workflow",
        linked_entity_id: "req-old",
        payload: { text: "Solicitação de reagendamento aberta." },
      }),
      buildMessage({
        id: "m2",
        message_type: "WORKFLOW_ACTION",
        linked_entity_type: "workflow",
        linked_entity_id: "req-new",
        payload: { action_key: "service_reschedule_proposed", text: "Nova data proposta" },
      }),
    ];

    expect(deriveLatestRescheduleRequestIdFromMessages(messages)).toBe("req-new");
  });

  it("detects reschedule proposal when list projection omits action_key", () => {
    const message = buildMessage({
      message_type: "WORKFLOW_ACTION",
      linked_entity_type: "workflow",
      linked_entity_id: "req-new",
      payload: { text: "Nova data proposta: 15/08/2026 (manhã)" },
    });

    expect(isServiceRescheduleProposedWorkflowMessage(message)).toBe(true);
    expect(deriveLatestRescheduleRequestIdFromMessages([message])).toBe("req-new");
  });
});
