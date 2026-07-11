import { describe, expect, it } from "vitest";
import type { CreateProviderProposalResult } from "@/features/negotiation-proposals";
import { proposalTimelineMessageToListItem } from "../proposalTimelineMessageToListItem";

describe("proposalTimelineMessageToListItem", () => {
  it("creates a sent proposal item linked to the proposal version", () => {
    const timelineMessage: NonNullable<
      CreateProviderProposalResult["timeline_message"]
    > = {
      id: "message-1",
      chat_id: "chat-1",
      message_type: "PROPOSAL",
      linked_entity_type: "proposal",
      linked_entity_id: "proposal-1",
      created_at: "2026-07-10T10:00:00.000Z",
    };

    expect(
      proposalTimelineMessageToListItem(timelineMessage, "provider-1", 3),
    ).toEqual({
      id: "message-1",
      chat_id: "chat-1",
      sender_user_id: "provider-1",
      message_type: "PROPOSAL",
      payload: {
        proposal_id: "proposal-1",
        version: 3,
      },
      linked_entity_type: "proposal",
      linked_entity_id: "proposal-1",
      idempotency_key: "message-1",
      delivery_status: "SENT",
      created_at: "2026-07-10T10:00:00.000Z",
      updated_at: "2026-07-10T10:00:00.000Z",
    });
  });
});
