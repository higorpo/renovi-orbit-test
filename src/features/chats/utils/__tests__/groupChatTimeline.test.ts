import { describe, expect, it } from "vitest";
import type { ChatMessageListItem } from "../../types/chats.types";
import {
  buildChatTimelineItems,
  CHAT_DISCOVERY_WELCOME_KEY,
  prependDiscoveryWelcomeToTimeline,
} from "../groupChatTimeline";

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
    const todayIso = new Date().toISOString();
    const messages = [
      makeMessage("1", "other", todayIso),
      makeMessage("2", "other", todayIso),
      makeMessage("3", "me", todayIso),
    ];

    const items = buildChatTimelineItems(messages, "me");
    const messageItems = items.filter((item) => item.type === "message");

    expect(items.some((item) => item.type === "date" && item.label === "Hoje")).toBe(true);
    expect(messageItems).toHaveLength(3);
    expect(messageItems[0]?.type === "message" && messageItems[0].showIncomingAvatar).toBe(true);
    expect(messageItems[0]?.type === "message" && messageItems[0].groupPosition).toBe("first");
    expect(messageItems[1]?.type === "message" && messageItems[1].showIncomingAvatar).toBe(false);
    expect(messageItems[1]?.type === "message" && messageItems[1].groupPosition).toBe("last");
    expect(messageItems[2]?.type === "message" && messageItems[2].isOutgoing).toBe(true);
    expect(messageItems[2]?.type === "message" && messageItems[2].groupPosition).toBe("single");
  });

  it("does not crash when a day boundary coincides with a sender change", () => {
    const messages = [
      makeMessage("1", "other", "2026-05-30T10:00:00.000Z"),
      makeMessage("2", "me", "2026-06-01T10:00:00.000Z"),
    ];

    const items = buildChatTimelineItems(messages, "me");
    const messageItems = items.filter((item) => item.type === "message");

    expect(messageItems).toHaveLength(2);
    expect(items.filter((item) => item.type === "date")).toHaveLength(2);
  });

  it("assigns middle position to messages between first and last in a group", () => {
    const baseTime = new Date("2026-05-30T12:00:00.000Z").getTime();
    const messages = [
      makeMessage("1", "other", new Date(baseTime).toISOString()),
      makeMessage("2", "other", new Date(baseTime + 1_000).toISOString()),
      makeMessage("3", "other", new Date(baseTime + 2_000).toISOString()),
    ];

    const items = buildChatTimelineItems(messages, "me");
    const messageItems = items.filter((item) => item.type === "message");

    expect(messageItems.map((item) => item.type === "message" && item.groupPosition)).toEqual([
      "first",
      "middle",
      "last",
    ]);
  });

  it("prepends date and discovery welcome when history is empty", () => {
    const items = prependDiscoveryWelcomeToTimeline([], "2026-06-01T12:00:00.000Z");

    expect(items).toHaveLength(2);
    expect(items[0]?.type).toBe("date");
    expect(items[1]?.type).toBe("discovery_welcome");
    expect(items[1]?.key).toBe(CHAT_DISCOVERY_WELCOME_KEY);
  });

  it("inserts discovery welcome after the first date separator when it matches the anchor day", () => {
    const messages = [makeMessage("1", "other", "2026-05-30T10:00:00.000Z")];
    const base = buildChatTimelineItems(messages, "me");
    const items = prependDiscoveryWelcomeToTimeline(base, "2026-05-30T09:00:00.000Z");

    expect(items[0]?.type).toBe("date");
    expect(items[1]?.type).toBe("discovery_welcome");
    expect(items[2]?.type).toBe("message");
    expect(items.filter((item) => item.type === "date")).toHaveLength(1);
  });

  it("prepends date and discovery welcome when anchor day differs from first message day", () => {
    const messages = [makeMessage("1", "other", "2026-06-01T10:00:00.000Z")];
    const base = buildChatTimelineItems(messages, "me");
    const items = prependDiscoveryWelcomeToTimeline(base, "2026-05-30T09:00:00.000Z");

    expect(items[0]?.type).toBe("date");
    expect(items[1]?.type).toBe("discovery_welcome");
    expect(items[2]?.type).toBe("date");
    expect(items[3]?.type).toBe("message");
  });
});
