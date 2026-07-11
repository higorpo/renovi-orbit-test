import { describe, expect, it, vi } from "vitest";
import { inboxChannelName, subscribeInboxChannel } from "../inboxRealtimeChannel";

describe("inboxRealtimeChannel", () => {
  it("builds stable channel names per user", () => {
    expect(inboxChannelName("user-abc")).toBe("inbox:user-abc");
  });

  it("registers chat_messages insert listener", () => {
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    };
    const client = { channel: vi.fn(() => channel) };

    subscribeInboxChannel(client as never, "user-1", {
      onMessageInsert: vi.fn(),
      onStatusChange: vi.fn(),
    });

    expect(client.channel).toHaveBeenCalledWith("inbox:user-1");
    expect(channel.on).toHaveBeenCalledTimes(1);
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
  });

  it("parses valid inserts and ignores invalid payloads", () => {
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((cb: (status: string) => void) => {
        cb("SUBSCRIBED");
        return channel;
      }),
    };
    const client = { channel: vi.fn(() => channel) };
    const onMessageInsert = vi.fn();
    const onStatusChange = vi.fn();

    subscribeInboxChannel(client as never, "user-1", {
      onMessageInsert,
      onStatusChange,
    });

    expect(onStatusChange).toHaveBeenCalledWith("SUBSCRIBED");

    const insertHandler = channel.on.mock.calls[0]?.[2] as (payload: unknown) => void;

    insertHandler({ new: null });
    expect(onMessageInsert).not.toHaveBeenCalled();

    insertHandler({
      new: {
        id: "m1",
        chat_id: "c1",
        sender_user_id: "u1",
        message_type: "TEXT",
        created_at: "2026-01-01T00:00:00.000Z",
        payload: { text: "oi" },
        linked_entity_type: "proposal",
        linked_entity_id: "p1",
      },
    });

    expect(onMessageInsert).toHaveBeenCalledWith({
      id: "m1",
      chatId: "c1",
      senderUserId: "u1",
      messageType: "TEXT",
      createdAt: "2026-01-01T00:00:00.000Z",
      payload: { text: "oi" },
      linkedEntityType: "proposal",
      linkedEntityId: "p1",
    });

    insertHandler({
      new: {
        id: "m2",
        chat_id: "c1",
        sender_user_id: "u1",
        message_type: "TEXT",
        created_at: "2026-01-01T00:00:00.000Z",
        payload: { text: "oi" },
      },
    });
    expect(onMessageInsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        linkedEntityType: null,
        linkedEntityId: null,
      }),
    );

    insertHandler({
      new: {
        id: 1,
        chat_id: "c1",
        sender_user_id: "u1",
        message_type: "TEXT",
        created_at: "2026-01-01T00:00:00.000Z",
        payload: { text: "oi" },
      },
    });
    expect(onMessageInsert).toHaveBeenCalledTimes(2);
  });
});
