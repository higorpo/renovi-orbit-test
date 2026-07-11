import { describe, expect, it } from "vitest";
import type { SendMessageResultMessage } from "../../types/chats.types";
import { sendMessageResultToListItem } from "../sendMessageToListItem";

describe("sendMessageResultToListItem", () => {
  it("turns a confirmed send result into a sent timeline item", () => {
    const message: SendMessageResultMessage = {
      id: "message-1",
      chat_id: "chat-1",
      sender_user_id: "user-1",
      message_type: "TEXT",
      payload: { text: "Hello" },
      idempotency_key: "send-1",
      created_at: "2026-07-10T10:00:00.000Z",
    };

    expect(sendMessageResultToListItem(message)).toEqual({
      ...message,
      linked_entity_type: null,
      linked_entity_id: null,
      delivery_status: "SENT",
      updated_at: message.created_at,
    });
  });
});
