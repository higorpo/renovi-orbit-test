import { describe, expect, it } from "vitest";
import type { ChatMessageListItem } from "../../types/chats.types";
import { deriveLatestProposalIdFromMessages } from "../deriveLatestProposalIdFromMessages";

function message(
  id: string,
  messageType: ChatMessageListItem["message_type"],
  linkedEntityId: string | null,
): ChatMessageListItem {
  return {
    id,
    chat_id: "chat-1",
    sender_user_id: "user-1",
    message_type: messageType,
    payload: {},
    linked_entity_type: linkedEntityId ? "proposal" : null,
    linked_entity_id: linkedEntityId,
    idempotency_key: `send-${id}`,
    delivery_status: "SENT",
    created_at: "2026-07-10T10:00:00.000Z",
    updated_at: "2026-07-10T10:00:00.000Z",
  };
}

describe("deriveLatestProposalIdFromMessages", () => {
  it("returns the linked id from the latest proposal message", () => {
    expect(
      deriveLatestProposalIdFromMessages([
        message("proposal-old", "PROPOSAL", "proposal-1"),
        message("text", "TEXT", null),
        message("proposal-new", "PROPOSAL", "proposal-2"),
      ]),
    ).toBe("proposal-2");
  });

  it("skips proposal messages without a linked entity id", () => {
    expect(
      deriveLatestProposalIdFromMessages([
        message("proposal-linked", "PROPOSAL", "proposal-1"),
        message("proposal-unlinked", "PROPOSAL", null),
      ]),
    ).toBe("proposal-1");
  });

  it("returns null when no linked proposal exists", () => {
    expect(
      deriveLatestProposalIdFromMessages([
        message("text", "TEXT", null),
        message("proposal-unlinked", "PROPOSAL", null),
      ]),
    ).toBeNull();
    expect(deriveLatestProposalIdFromMessages([])).toBeNull();
  });
});
