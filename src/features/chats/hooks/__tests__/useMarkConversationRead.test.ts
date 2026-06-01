// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessageListItem } from "../../types/chats.types";
import { useMarkConversationRead } from "../useMarkConversationRead";

const markConversationReadMock = vi.fn();

vi.mock("../../api/chats.api", () => ({
  markConversationRead: (...args: unknown[]) => markConversationReadMock(...args),
}));

function message(id: string): ChatMessageListItem {
  return {
    id,
    chat_id: "chat-1",
    sender_user_id: "user-1",
    message_type: "TEXT",
    payload: { text: "hi" },
    linked_entity_type: null,
    linked_entity_id: null,
    idempotency_key: id,
    delivery_status: "SENT",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("useMarkConversationRead", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    markConversationReadMock.mockResolvedValue({ data: { last_read_at: "2026-01-01" }, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("does not call mark read with null when an optimistic row is pending", async () => {
    const { rerender } = renderHook(
      ({ messages }: { messages: ChatMessageListItem[] }) =>
        useMarkConversationRead("chat-1", messages),
      { initialProps: { messages: [message("msg-1")] } },
    );

    await vi.advanceTimersByTimeAsync(500);
    expect(markConversationReadMock).toHaveBeenCalledTimes(1);
    markConversationReadMock.mockClear();

    rerender({
      messages: [
        message("msg-1"),
        {
          ...message("optimistic:abc"),
          id: "optimistic:abc",
        },
      ],
    });

    await vi.advanceTimersByTimeAsync(500);

    expect(markConversationReadMock).not.toHaveBeenCalled();
  });

  it("debounces mark read for the latest server message id", async () => {
    const { rerender } = renderHook(
      ({ messages }: { messages: ChatMessageListItem[] }) =>
        useMarkConversationRead("chat-1", messages),
      { initialProps: { messages: [message("msg-1")] } },
    );

    rerender({ messages: [message("msg-1"), message("msg-2")] });

    await vi.advanceTimersByTimeAsync(500);

    expect(markConversationReadMock).toHaveBeenCalledTimes(1);
    expect(markConversationReadMock).toHaveBeenCalledWith({
      chatId: "chat-1",
      lastReadMessageId: "msg-2",
    });
  });
});
