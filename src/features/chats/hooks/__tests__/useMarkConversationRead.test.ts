// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAT_CONVERSATIONS_LIST_QUERY_KEY } from "../../constants/queryKeys";
import type { ChatMessageListItem, ConversationListItem, ConversationListResponse } from "../../types/chats.types";
import { useMarkConversationRead } from "../useMarkConversationRead";

const markConversationReadMock = vi.fn();

vi.mock("../../api/chats.api", () => ({
  markConversationRead: (...args: unknown[]) => markConversationReadMock(...args),
}));

const unreadListItem: ConversationListItem = {
  id: "chat-1",
  service_request_id: "sr-1",
  client_id: "client-1",
  provider_id: "provider-1",
  status: "ACTIVE",
  last_interaction_at: "2026-01-01T10:00:00.000Z",
  activated_at: "2026-01-01T09:00:00.000Z",
  inactivated_at: null,
  closed_at: null,
  created_at: "2026-01-01T09:00:00.000Z",
  updated_at: "2026-01-01T10:00:00.000Z",
  counterparty: {
    id: "provider-1",
    full_name: "Prestador",
    profile_image_path: null,
    role: "provider",
  },
  service_request_title: "Pintura",
  service: {
    id: "svc-1",
    title: "Pintura",
    slug: "pintura",
    icon_key: null,
    color_key: null,
    image_url: null,
  },
  last_message: {
    id: "msg-1",
    message_type: "TEXT",
    created_at: "2026-01-01T00:00:00.000Z",
    preview_text: "hi",
    linked_entity_type: null,
    linked_entity_id: null,
  },
  is_unread: true,
  last_read_at: null,
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

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
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData([CHAT_CONVERSATIONS_LIST_QUERY_KEY, 20], {
      pages: [{ items: [unreadListItem], has_more: false, next_cursor: null } satisfies ConversationListResponse],
      pageParams: [null],
    });
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
      {
        initialProps: { messages: [message("msg-1")] },
        wrapper: createWrapper(queryClient),
      },
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
      {
        initialProps: { messages: [message("msg-1")] },
        wrapper: createWrapper(queryClient),
      },
    );

    rerender({ messages: [message("msg-1"), message("msg-2")] });

    await vi.advanceTimersByTimeAsync(500);

    expect(markConversationReadMock).toHaveBeenCalledTimes(1);
    expect(markConversationReadMock).toHaveBeenCalledWith({
      chatId: "chat-1",
      lastReadMessageId: "msg-2",
    });
  });

  it("clears unread dot in the inbox cache when the conversation is marked read", async () => {
    renderHook(() => useMarkConversationRead("chat-1", [message("msg-1")]), {
      wrapper: createWrapper(queryClient),
    });

    await vi.advanceTimersByTimeAsync(500);

    const data = queryClient.getQueryData<{ pages: ConversationListResponse[] }>([
      CHAT_CONVERSATIONS_LIST_QUERY_KEY,
      20,
    ]);

    expect(data?.pages[0]?.items[0]?.is_unread).toBe(false);
    expect(data?.pages[0]?.items[0]?.last_read_at).toBe("2026-01-01T00:00:00.000Z");
  });
});
