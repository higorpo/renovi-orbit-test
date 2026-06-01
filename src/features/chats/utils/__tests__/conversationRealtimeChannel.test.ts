import { describe, expect, it, vi } from "vitest";
import {
  conversationChannelName,
  subscribeConversationChannel,
} from "../conversationRealtimeChannel";

describe("conversationRealtimeChannel", () => {
  it("builds stable channel names", () => {
    expect(conversationChannelName("abc-123")).toBe("conversation:abc-123");
  });

  it("registers message and proposal listeners", () => {
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    };
    const client = { channel: vi.fn(() => channel) };

    subscribeConversationChannel(client as never, "chat-1", {
      onMessageInsert: vi.fn(),
      onProposalUpdate: vi.fn(),
      onReadReceiptChange: vi.fn(),
      onStatusChange: vi.fn(),
    });

    expect(client.channel).toHaveBeenCalledWith("conversation:chat-1");
    expect(channel.on).toHaveBeenCalledTimes(4);
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
  });
});
