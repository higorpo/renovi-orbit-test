import { describe, expect, it, vi } from "vitest";
import {
  conversationChannelName,
  subscribeConversationChannel,
} from "../conversationRealtimeChannel";

describe("conversationRealtimeChannel", () => {
  it("builds stable channel names", () => {
    expect(conversationChannelName("abc-123")).toBe("conversation:abc-123");
  });

  it("registers message, reschedule, and read-receipt listeners without proposal scope", () => {
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    };
    const client = { channel: vi.fn(() => channel) };

    subscribeConversationChannel(client as never, "chat-1", {
      onMessageInsert: vi.fn(),
      onProposalUpdate: vi.fn(),
      onRescheduleRequestChange: vi.fn(),
      onReadReceiptChange: vi.fn(),
      onStatusChange: vi.fn(),
    });

    expect(client.channel).toHaveBeenCalledWith("conversation:chat-1");
    expect(channel.on).toHaveBeenCalledTimes(5);
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
  });

  it("registers proposal listener filtered by service_request_id when scope is provided", () => {
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    };
    const client = { channel: vi.fn(() => channel) };
    const onProposalUpdate = vi.fn();

    subscribeConversationChannel(
      client as never,
      "chat-1",
      {
        onMessageInsert: vi.fn(),
        onProposalUpdate,
        onRescheduleRequestChange: vi.fn(),
        onReadReceiptChange: vi.fn(),
        onStatusChange: vi.fn(),
      },
      { serviceRequestId: "sr-1", providerId: "provider-1" },
    );

    expect(channel.on).toHaveBeenCalledTimes(6);

    const proposalBinding = channel.on.mock.calls.find(
      ([, filter]) =>
        typeof filter === "object" &&
        filter !== null &&
        "table" in filter &&
        (filter as { table: string }).table === "provider_proposals",
    );
    expect(proposalBinding?.[1]).toMatchObject({
      event: "UPDATE",
      table: "provider_proposals",
      filter: "service_request_id=eq.sr-1",
    });

    const proposalHandler = proposalBinding?.[2] as (payload: { new: Record<string, string> }) => void;
    proposalHandler({
      new: { id: "proposal-1", provider_id: "provider-1" },
    });
    expect(onProposalUpdate).toHaveBeenCalledWith({ id: "proposal-1" });

    onProposalUpdate.mockClear();
    proposalHandler({
      new: { id: "proposal-2", provider_id: "other-provider" },
    });
    expect(onProposalUpdate).not.toHaveBeenCalled();
  });

  it("registers reschedule listeners filtered by chat_id", () => {
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    };
    const client = { channel: vi.fn(() => channel) };
    const onRescheduleRequestChange = vi.fn();

    subscribeConversationChannel(client as never, "chat-1", {
      onMessageInsert: vi.fn(),
      onProposalUpdate: vi.fn(),
      onRescheduleRequestChange,
      onReadReceiptChange: vi.fn(),
      onStatusChange: vi.fn(),
    });

    const rescheduleBindings = channel.on.mock.calls.filter(
      ([, filter]) =>
        typeof filter === "object" &&
        filter !== null &&
        "table" in filter &&
        (filter as { table: string }).table === "service_reschedule_requests",
    );

    expect(rescheduleBindings).toHaveLength(2);
    expect(rescheduleBindings[0]?.[1]).toMatchObject({
      event: "INSERT",
      filter: "chat_id=eq.chat-1",
    });
    expect(rescheduleBindings[1]?.[1]).toMatchObject({
      event: "UPDATE",
      filter: "chat_id=eq.chat-1",
    });

    const updateHandler = rescheduleBindings[1]?.[2] as (payload: {
      new: Record<string, string>;
    }) => void;
    updateHandler({
      new: {
        id: "req-1",
        status: "PROPOSED",
        updated_at: "2026-07-08T12:00:00.000Z",
      },
    });
    expect(onRescheduleRequestChange).toHaveBeenCalledWith({
      id: "req-1",
      status: "PROPOSED",
      updatedAt: "2026-07-08T12:00:00.000Z",
    });

    onRescheduleRequestChange.mockClear();
    updateHandler({
      new: {
        id: "req-1",
        status: "ADJUSTMENT_REQUESTED",
        updated_at: "2026-07-08T12:05:00.000Z",
      },
    });
    expect(onRescheduleRequestChange).toHaveBeenCalledWith({
      id: "req-1",
      status: "ADJUSTMENT_REQUESTED",
      updatedAt: "2026-07-08T12:05:00.000Z",
    });
  });

  it("forwards message inserts, read receipts and subscription status", () => {
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((cb: (status: string) => void) => {
        cb("SUBSCRIBED");
        return channel;
      }),
    };
    const client = { channel: vi.fn(() => channel) };
    const onMessageInsert = vi.fn();
    const onReadReceiptChange = vi.fn();
    const onStatusChange = vi.fn();
    const onRescheduleRequestChange = vi.fn();

    subscribeConversationChannel(client as never, "chat-1", {
      onMessageInsert,
      onProposalUpdate: vi.fn(),
      onRescheduleRequestChange,
      onReadReceiptChange,
      onStatusChange,
    });

    expect(onStatusChange).toHaveBeenCalledWith("SUBSCRIBED");

    const messageHandler = channel.on.mock.calls.find(
      ([, filter]) =>
        typeof filter === "object" &&
        filter !== null &&
        "table" in filter &&
        (filter as { table: string }).table === "chat_messages",
    )?.[2] as (payload: { new: Record<string, string> | null }) => void;

    messageHandler({ new: { id: "m1" } });
    expect(onMessageInsert).toHaveBeenCalledWith({ id: "m1" });
    messageHandler({ new: null });
    expect(onMessageInsert).toHaveBeenCalledTimes(1);

    const receiptHandler = channel.on.mock.calls.find(
      ([, filter]) =>
        typeof filter === "object" &&
        filter !== null &&
        "table" in filter &&
        (filter as { table: string }).table === "chat_read_receipts" &&
        (filter as { event: string }).event === "INSERT",
    )?.[2] as (payload: { new: Record<string, string | null> | null }) => void;

    receiptHandler({
      new: {
        user_id: "user-2",
        last_read_message_id: "m1",
        last_read_at: "2026-01-01T12:00:00.000Z",
      },
    });
    expect(onReadReceiptChange).toHaveBeenCalledWith({
      userId: "user-2",
      lastReadMessageId: "m1",
      lastReadAt: "2026-01-01T12:00:00.000Z",
    });

    receiptHandler({
      new: {
        user_id: "user-2",
        last_read_message_id: null,
        last_read_at: "2026-01-01T12:01:00.000Z",
      },
    });
    expect(onReadReceiptChange).toHaveBeenLastCalledWith({
      userId: "user-2",
      lastReadMessageId: null,
      lastReadAt: "2026-01-01T12:01:00.000Z",
    });

    const rescheduleInsert = channel.on.mock.calls.find(
      ([, filter]) =>
        typeof filter === "object" &&
        filter !== null &&
        "table" in filter &&
        (filter as { table: string }).table === "service_reschedule_requests" &&
        (filter as { event: string }).event === "INSERT",
    )?.[2] as (payload: { new: Record<string, string> | null }) => void;

    rescheduleInsert({ new: { id: "req-x" } });
    expect(onRescheduleRequestChange).not.toHaveBeenCalled();
  });
});
