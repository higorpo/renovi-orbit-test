import { describe, expect, it } from "vitest";
import type { ChatMessageListItem } from "../../types/chats.types";
import { resolveCounterpartyViewedMessageId } from "../resolveCounterpartyViewedMessageId";

function msg(
  partial: Pick<ChatMessageListItem, "id" | "sender_user_id" | "created_at">,
): ChatMessageListItem {
  return {
    id: partial.id,
    chat_id: "chat-1",
    sender_user_id: partial.sender_user_id,
    message_type: "TEXT",
    payload: { text: "hi" },
    linked_entity_type: null,
    linked_entity_id: null,
    idempotency_key: partial.id,
    delivery_status: "SENT",
    created_at: partial.created_at,
    updated_at: partial.created_at,
  };
}

const ME = "user-me";
const THEM = "user-them";

describe("resolveCounterpartyViewedMessageId", () => {
  it("returns null when receipt or user is missing", () => {
    const messages = [msg({ id: "m1", sender_user_id: ME, created_at: "2026-01-01T10:00:00Z" })];
    expect(resolveCounterpartyViewedMessageId(messages, ME, null)).toBeNull();
    expect(
      resolveCounterpartyViewedMessageId(messages, null, {
        last_read_at: "2026-01-01T10:00:00Z",
        last_read_message_id: "m1",
      }),
    ).toBeNull();
  });

  it("returns the newest outgoing message when read cursor is on it", () => {
    const messages = [
      msg({ id: "m1", sender_user_id: ME, created_at: "2026-01-01T10:00:00Z" }),
      msg({ id: "m2", sender_user_id: ME, created_at: "2026-01-01T10:01:00Z" }),
    ];

    expect(
      resolveCounterpartyViewedMessageId(messages, ME, {
        last_read_at: "2026-01-01T10:01:00Z",
        last_read_message_id: "m2",
      }),
    ).toBe("m2");
  });

  it("returns last outgoing message at or before read cursor by message id", () => {
    const messages = [
      msg({ id: "m1", sender_user_id: THEM, created_at: "2026-01-01T10:00:00Z" }),
      msg({ id: "m2", sender_user_id: ME, created_at: "2026-01-01T10:01:00Z" }),
      msg({ id: "m3", sender_user_id: ME, created_at: "2026-01-01T10:02:00Z" }),
      msg({ id: "m4", sender_user_id: THEM, created_at: "2026-01-01T10:03:00Z" }),
    ];

    expect(
      resolveCounterpartyViewedMessageId(messages, ME, {
        last_read_at: "2026-01-01T10:03:00Z",
        last_read_message_id: "m4",
      }),
    ).toBe("m3");
  });

  it("falls back to last_read_at when message id is not loaded", () => {
    const messages = [
      msg({ id: "m1", sender_user_id: ME, created_at: "2026-01-01T10:00:00Z" }),
      msg({ id: "m2", sender_user_id: THEM, created_at: "2026-01-01T10:01:00Z" }),
    ];

    expect(
      resolveCounterpartyViewedMessageId(messages, ME, {
        last_read_at: "2026-01-01T10:00:00Z",
        last_read_message_id: "missing-id",
      }),
    ).toBe("m1");
  });

  it("ignores optimistic outgoing rows", () => {
    const messages = [
      msg({ id: "m1", sender_user_id: ME, created_at: "2026-01-01T10:00:00Z" }),
      msg({ id: "optimistic:tmp", sender_user_id: ME, created_at: "2026-01-01T10:02:00Z" }),
    ];

    expect(
      resolveCounterpartyViewedMessageId(messages, ME, {
        last_read_at: "2026-01-01T10:02:00Z",
        last_read_message_id: "optimistic:tmp",
      }),
    ).toBe("m1");
  });

  it("returns null when counterparty has not read any outgoing message", () => {
    const messages = [
      msg({ id: "m1", sender_user_id: THEM, created_at: "2026-01-01T10:00:00Z" }),
      msg({ id: "m2", sender_user_id: ME, created_at: "2026-01-01T10:01:00Z" }),
    ];

    expect(
      resolveCounterpartyViewedMessageId(messages, ME, {
        last_read_at: "2026-01-01T10:00:00Z",
        last_read_message_id: "m1",
      }),
    ).toBeNull();
  });
});
