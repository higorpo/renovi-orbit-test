import { describe, expect, it } from "vitest";
import type { ChatMessageListItem } from "../../types/chats.types";
import { areChatMessageListItemsEqual } from "../chatMessageEquality";

const baseMessage: ChatMessageListItem = {
  id: "message-1",
  chat_id: "chat-1",
  sender_user_id: "user-1",
  message_type: "TEXT",
  payload: { text: "Hello", metadata: { edited: false } },
  linked_entity_type: null,
  linked_entity_id: null,
  idempotency_key: "send-1",
  delivery_status: "SENT",
  created_at: "2026-07-10T10:00:00.000Z",
  updated_at: "2026-07-10T10:00:00.000Z",
};

describe("areChatMessageListItemsEqual", () => {
  it("treats separate messages with the same renderable content as equal", () => {
    const copy = {
      ...baseMessage,
      payload: { text: "Hello", metadata: { edited: false } },
    };

    expect(areChatMessageListItemsEqual(baseMessage, copy)).toBe(true);
  });

  it.each([
    ["id", "message-2"],
    ["chat_id", "chat-2"],
    ["sender_user_id", "user-2"],
    ["message_type", "IMAGE"],
    ["delivery_status", "FAILED"],
    ["created_at", "2026-07-10T10:01:00.000Z"],
    ["updated_at", "2026-07-10T10:01:00.000Z"],
    ["linked_entity_type", "proposal"],
    ["linked_entity_id", "proposal-1"],
    ["idempotency_key", "send-2"],
  ] satisfies Array<[keyof ChatMessageListItem, ChatMessageListItem[keyof ChatMessageListItem]]>)(
    "detects a changed %s field",
    (field, value) => {
      expect(
        areChatMessageListItemsEqual(baseMessage, {
          ...baseMessage,
          [field]: value,
        }),
      ).toBe(false);
    },
  );

  it("detects changes inside the message payload", () => {
    expect(
      areChatMessageListItemsEqual(baseMessage, {
        ...baseMessage,
        payload: { text: "Hello", metadata: { edited: true } },
      }),
    ).toBe(false);
  });
});
