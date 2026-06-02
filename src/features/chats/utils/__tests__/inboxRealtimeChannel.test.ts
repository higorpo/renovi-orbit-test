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
});
