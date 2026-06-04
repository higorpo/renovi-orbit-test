import { describe, expect, it } from "vitest";
import type { ChatMessageListItem } from "../../types/chats.types";
import {
  collectRecentUserTextMessages,
  moderateChatComposerSend,
} from "../moderateChatComposerSend";

function textMessage(
  partial: Pick<ChatMessageListItem, "id" | "sender_user_id" | "created_at"> & {
    text: string;
  },
): ChatMessageListItem {
  return {
    chat_id: "chat-1",
    message_type: "TEXT",
    payload: { text: partial.text },
    linked_entity_type: null,
    linked_entity_id: null,
    idempotency_key: `key-${partial.id}`,
    delivery_status: "SENT",
    updated_at: partial.created_at,
    ...partial,
  };
}

describe("moderateChatComposerSend", () => {
  it("collects only recent text messages from the current user", () => {
    const messages = [
      textMessage({
        id: "1",
        sender_user_id: "user-a",
        created_at: "2026-01-01T10:00:00.000Z",
        text: "9",
      }),
      textMessage({
        id: "2",
        sender_user_id: "user-b",
        created_at: "2026-01-01T10:01:00.000Z",
        text: "resposta",
      }),
      textMessage({
        id: "3",
        sender_user_id: "user-a",
        created_at: "2026-01-01T10:02:00.000Z",
        text: "996",
      }),
    ];

    expect(collectRecentUserTextMessages(messages, "user-a")).toEqual(["9", "996"]);
  });

  it("blocks split phone numbers using recent user messages", () => {
    const messages = [
      textMessage({
        id: "1",
        sender_user_id: "user-a",
        created_at: "2026-01-01T10:00:00.000Z",
        text: "9",
      }),
      textMessage({
        id: "2",
        sender_user_id: "user-a",
        created_at: "2026-01-01T10:01:00.000Z",
        text: "996",
      }),
      textMessage({
        id: "3",
        sender_user_id: "user-a",
        created_at: "2026-01-01T10:02:00.000Z",
        text: "oi",
      }),
      textMessage({
        id: "4",
        sender_user_id: "user-a",
        created_at: "2026-01-01T10:03:00.000Z",
        text: "453",
      }),
    ];

    const result = moderateChatComposerSend({
      text: "859",
      messages,
      userId: "user-a",
    });

    expect(result.allowed).toBe(false);
    expect(result.violation).toBe("phone");
    expect(result.message).toBeTruthy();
  });
});
