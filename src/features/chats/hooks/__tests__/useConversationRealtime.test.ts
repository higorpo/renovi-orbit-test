// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConversationRealtime } from "../useConversationRealtime";

const {
  onHandlers,
  channelMock,
  supabaseChannelMock,
  removeChannelMock,
} = vi.hoisted(() => {
  const onHandlers: {
    messageInsert?: (payload: { id: string }) => void;
    proposalUpdate?: (payload: { id: string }) => void;
    readReceiptChange?: (payload: {
      userId: string;
      lastReadMessageId: string | null;
      lastReadAt: string;
    }) => void;
    statusChange?: (status: string) => void;
  } = {};

  const channelMock = {
    on: vi.fn((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      if (_filter && typeof _filter === "object" && "table" in (_filter as object)) {
        const table = (_filter as { table: string }).table;
        if (table === "chat_messages") {
          onHandlers.messageInsert = handler as (payload: { id: string }) => void;
        }
        if (table === "provider_proposals") {
          onHandlers.proposalUpdate = handler as (payload: { id: string }) => void;
        }
        if (table === "chat_read_receipts") {
          onHandlers.readReceiptChange = handler as (payload: {
            userId: string;
            lastReadMessageId: string | null;
            lastReadAt: string;
          }) => void;
        }
      }
      return channelMock;
    }),
    subscribe: vi.fn((cb: (status: string) => void) => {
      onHandlers.statusChange = cb;
      cb("SUBSCRIBED");
      return channelMock;
    }),
  };

  return {
    onHandlers,
    channelMock,
    supabaseChannelMock: vi.fn(() => channelMock),
    removeChannelMock: vi.fn(),
  };
});

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    channel: supabaseChannelMock,
    removeChannel: removeChannelMock,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  onHandlers.messageInsert = undefined;
  onHandlers.proposalUpdate = undefined;
  onHandlers.readReceiptChange = undefined;
  onHandlers.statusChange = undefined;
  supabaseChannelMock.mockImplementation(() => channelMock);
});

describe("useConversationRealtime", () => {
  it("subscribes to conversation channel with postgres filters", async () => {
    const onReconcile = vi.fn();
    renderHook(() => useConversationRealtime("chat-1", { onReconcile }), {
      wrapper: createWrapper(),
    });

    expect(supabaseChannelMock).toHaveBeenCalledWith("conversation:chat-1");
    expect(channelMock.on).toHaveBeenCalledTimes(4);
    await waitFor(() => expect(onReconcile).toHaveBeenCalled());
  });

  it("does not resubscribe when onReconcile callback identity changes", async () => {
    const onReconcile = vi.fn();

    const { rerender } = renderHook(
      ({ tick }: { tick: number }) => {
        void tick;
        return useConversationRealtime("chat-1", {
          onReconcile: () => onReconcile(),
        });
      },
      { wrapper: createWrapper(), initialProps: { tick: 0 } },
    );

    await waitFor(() => expect(onReconcile).toHaveBeenCalledTimes(1));
    expect(supabaseChannelMock).toHaveBeenCalledTimes(1);

    rerender({ tick: 1 });
    rerender({ tick: 2 });

    await waitFor(() => expect(removeChannelMock).not.toHaveBeenCalled());
    expect(onReconcile).toHaveBeenCalledTimes(1);
    expect(supabaseChannelMock).toHaveBeenCalledTimes(1);
  });

  it("dedupes duplicate INSERT events", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    }

    renderHook(() => useConversationRealtime("chat-1"), { wrapper: Wrapper });

    const payload = { new: { id: "msg-dup" } };
    onHandlers.messageInsert?.(payload as never);
    onHandlers.messageInsert?.(payload as never);

    await waitFor(() => {
      const messageInvalidations = invalidateSpy.mock.calls.filter(
        (call) => call[0]?.queryKey?.[0] === "chat-messages",
      );
      expect(messageInvalidations).toHaveLength(1);
    });
  });

  it("invalidates conversation detail on each counterparty read cursor advance", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    }

    renderHook(
      () => useConversationRealtime("chat-1", { currentUserId: "user-a" }),
      { wrapper: Wrapper },
    );

    const readPayload = (messageId: string, readAt: string) =>
      ({
        new: {
          user_id: "user-b",
          last_read_message_id: messageId,
          last_read_at: readAt,
        },
      }) as never;

    onHandlers.readReceiptChange?.(readPayload("msg-1", "2026-01-01T10:00:00Z"));
    onHandlers.readReceiptChange?.(readPayload("msg-2", "2026-01-01T10:01:00Z"));

    await waitFor(() => {
      const detailInvalidations = invalidateSpy.mock.calls.filter(
        (call) => call[0]?.queryKey?.[0] === "conversation-detail",
      );
      expect(detailInvalidations).toHaveLength(2);
    });
  });

  it("skips all invalidations for recently sent own message", async () => {
    const { rememberSentChatMessageId } = await import("../../utils/chatMessageSendSync");
    rememberSentChatMessageId("msg-own");

    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    }

    renderHook(() => useConversationRealtime("chat-1"), { wrapper: Wrapper });

    onHandlers.messageInsert?.({ new: { id: "msg-own" } } as never);

    await waitFor(() => {
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });
});
