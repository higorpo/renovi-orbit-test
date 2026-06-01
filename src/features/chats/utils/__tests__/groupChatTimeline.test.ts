import { describe, expect, it } from "vitest";
import type { ChatMessageListItem } from "../../types/chats.types";
import { buildChatTimelineItems } from "../groupChatTimeline";

function makeMessage(
  id: string,
  senderUserId: string,
  createdAt: string,
): ChatMessageListItem {
  return {
    id,
    chat_id: "chat-1",
    sender_user_id: senderUserId,
    message_type: "TEXT",
    payload: { text: `msg-${id}` },
    linked_entity_type: null,
    linked_entity_id: null,
    idempotency_key: `key-${id}`,
    delivery_status: "SENT",
    created_at: createdAt,
    updated_at: createdAt,
  };
}

describe("buildChatTimelineItems", () => {
  it("inserts date separators and groups consecutive messages by sender", () => {
    const messages = [
      makeMessage("1", "other", "2026-05-30T10:00:00.000Z"),
      makeMessage("2", "other", "2026-05-30T10:01:00.000Z"),
      makeMessage("3", "me", "2026-05-30T10:02:00.000Z"),
    ];

    const items = buildChatTimelineItems(messages, "me");
    const messageItems = items.filter((item) => item.type === "message");

    expect(items.some((item) => item.type === "date" && item.label === "Hoje")).toBe(true);
    expect(messageItems).toHaveLength(3);
    expect(messageItems[0]?.type === "message" && messageItems[0].showIncomingAvatar).toBe(true);
    expect(messageItems[1]?.type === "message" && messageItems[1].showIncomingAvatar).toBe(false);
    expect(messageItems[2]?.type === "message" && messageItems[2].isOutgoing).toBe(true);
  });
});
