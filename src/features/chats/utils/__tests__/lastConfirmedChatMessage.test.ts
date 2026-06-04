import { describe, expect, it } from "vitest";
import type { ChatMessageListItem } from "../../types/chats.types";
import { lastConfirmedChatMessage } from "../lastConfirmedChatMessage";

function message(id: string): ChatMessageListItem {
  return {
    id,
    chat_id: "chat-1",
    sender_user_id: "user-1",
    message_type: "TEXT",
    payload: { text: "hi" },
    linked_entity_type: null,
    linked_entity_id: null,
    idempotency_key: "k1",
    delivery_status: "SENT",
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-01T10:00:00.000Z",
  };
}

describe("lastConfirmedChatMessage", () => {
  it("skips trailing optimistic rows", () => {
    expect(
      lastConfirmedChatMessage([
        message("msg-1"),
        message("optimistic:abc"),
      ])?.id,
    ).toBe("msg-1");
  });
});
