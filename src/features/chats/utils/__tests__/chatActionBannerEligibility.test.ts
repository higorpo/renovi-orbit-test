import { describe, expect, it } from "vitest";
import type { ChatMessageListItem } from "../../types/chats.types";
import {
  CHAT_CLOSE_BANNER_INACTIVITY_MS,
  hasMinimumProviderClientExchange,
  isChatInactiveForCloseBanner,
} from "../chatActionBannerEligibility";

const CLIENT_ID = "client-1";
const PROVIDER_ID = "provider-1";

function exchangeMessage(
  partial: Pick<ChatMessageListItem, "id" | "sender_user_id" | "created_at" | "message_type">,
): ChatMessageListItem {
  return {
    id: partial.id,
    chat_id: "chat-1",
    sender_user_id: partial.sender_user_id,
    message_type: partial.message_type ?? "TEXT",
    payload: {},
    linked_entity_type: null,
    linked_entity_id: null,
    idempotency_key: partial.id,
    delivery_status: "SENT",
    created_at: partial.created_at,
    updated_at: partial.created_at,
  };
}

describe("hasMinimumProviderClientExchange", () => {
  it("returns false when there are no messages", () => {
    expect(hasMinimumProviderClientExchange([], CLIENT_ID, PROVIDER_ID)).toBe(false);
  });

  it("returns false when only the provider has messaged", () => {
    const messages = [
      exchangeMessage({
        id: "m1",
        sender_user_id: PROVIDER_ID,
        created_at: "2026-01-01T10:00:00.000Z",
      }),
    ];

    expect(hasMinimumProviderClientExchange(messages, CLIENT_ID, PROVIDER_ID)).toBe(false);
  });

  it("returns false when the client messaged but the provider has not", () => {
    const messages = [
      exchangeMessage({
        id: "m1",
        sender_user_id: CLIENT_ID,
        created_at: "2026-01-01T10:00:00.000Z",
      }),
    ];

    expect(hasMinimumProviderClientExchange(messages, CLIENT_ID, PROVIDER_ID)).toBe(false);
  });

  it("returns true when the provider messaged and the client replied after", () => {
    const messages = [
      exchangeMessage({
        id: "m1",
        sender_user_id: PROVIDER_ID,
        created_at: "2026-01-01T10:00:00.000Z",
      }),
      exchangeMessage({
        id: "m2",
        sender_user_id: CLIENT_ID,
        created_at: "2026-01-01T10:01:00.000Z",
      }),
    ];

    expect(hasMinimumProviderClientExchange(messages, CLIENT_ID, PROVIDER_ID)).toBe(true);
  });

  it("ignores system and proposal messages for the exchange gate", () => {
    const messages = [
      exchangeMessage({
        id: "m1",
        sender_user_id: PROVIDER_ID,
        created_at: "2026-01-01T10:00:00.000Z",
        message_type: "PROPOSAL",
      }),
      exchangeMessage({
        id: "m2",
        sender_user_id: CLIENT_ID,
        created_at: "2026-01-01T10:01:00.000Z",
      }),
    ];

    expect(hasMinimumProviderClientExchange(messages, CLIENT_ID, PROVIDER_ID)).toBe(false);
  });
});

describe("isChatInactiveForCloseBanner", () => {
  const now = new Date("2026-06-02T12:00:00.000Z");

  it("returns false when last interaction is within 12 hours", () => {
    const recent = new Date(now.getTime() - CHAT_CLOSE_BANNER_INACTIVITY_MS + 60_000).toISOString();
    expect(isChatInactiveForCloseBanner(recent, now)).toBe(false);
  });

  it("returns true when last interaction is at least 12 hours ago", () => {
    const stale = new Date(now.getTime() - CHAT_CLOSE_BANNER_INACTIVITY_MS).toISOString();
    expect(isChatInactiveForCloseBanner(stale, now)).toBe(true);
  });

  it("returns false for missing or invalid timestamps", () => {
    expect(isChatInactiveForCloseBanner(null, now)).toBe(false);
    expect(isChatInactiveForCloseBanner("invalid", now)).toBe(false);
  });
});
