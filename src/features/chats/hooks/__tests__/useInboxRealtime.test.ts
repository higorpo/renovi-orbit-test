// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CHAT_CONVERSATIONS_LIST_QUERY_KEY } from "../../constants/queryKeys";
import type { ConversationListItem } from "../../types/chats.types";
import { useInboxRealtime } from "../useInboxRealtime";

const {
  onHandlers,
  channelMock,
  supabaseChannelMock,
  removeChannelMock,
} = vi.hoisted(() => {
  const onHandlers: {
    messageInsert?: (payload: unknown) => void;
    statusChange?: (status: string) => void;
  } = {};

  const channelMock = {
    on: vi.fn((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
      if (_filter && typeof _filter === "object" && "table" in (_filter as object)) {
        const table = (_filter as { table: string }).table;
        if (table === "chat_messages") {
          onHandlers.messageInsert = handler;
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

vi.mock("@/features/auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

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

const listItem: ConversationListItem = {
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
    id: "msg-old",
    message_type: "TEXT",
    created_at: "2026-01-01T10:00:00.000Z",
    preview_text: "Mensagem antiga",
    linked_entity_type: null,
    linked_entity_id: null,
  },
  is_unread: false,
  last_read_at: "2026-01-01T10:00:00.000Z",
};

function createWrapper() {
  const queryClient = new QueryClient();
  queryClient.setQueryData([CHAT_CONVERSATIONS_LIST_QUERY_KEY, 20], {
    pages: [{ items: [listItem], has_more: false, next_cursor: null }],
    pageParams: [null],
  });

  return {
    queryClient,
    Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: queryClient }, children);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  onHandlers.messageInsert = undefined;
  onHandlers.statusChange = undefined;
  supabaseChannelMock.mockImplementation(() => channelMock);
});

describe("useInboxRealtime", () => {
  it("subscribes to inbox channel scoped by user id", () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useInboxRealtime(), { wrapper: Wrapper });

    expect(supabaseChannelMock).toHaveBeenCalledWith("inbox:user-1");
    expect(channelMock.on).toHaveBeenCalledTimes(1);
  });

  it("patches the conversation list when a counterparty message arrives", async () => {
    const { Wrapper, queryClient } = createWrapper();
    renderHook(() => useInboxRealtime(), { wrapper: Wrapper });

    onHandlers.messageInsert?.({
      new: {
        id: "msg-new",
        chat_id: "chat-1",
        sender_user_id: "provider-1",
        message_type: "TEXT",
        created_at: "2026-01-01T11:00:00.000Z",
        payload: { text: "Chegou agora" },
        linked_entity_type: null,
        linked_entity_id: null,
      },
    });

    await waitFor(() => {
      const data = queryClient.getQueryData<{ pages: Array<{ items: ConversationListItem[] }> }>([
        CHAT_CONVERSATIONS_LIST_QUERY_KEY,
        20,
      ]);

      expect(data?.pages[0]?.items[0]?.last_message?.preview_text).toBe("Chegou agora");
      expect(data?.pages[0]?.items[0]?.last_interaction_at).toBe("2026-01-01T11:00:00.000Z");
      expect(data?.pages[0]?.items[0]?.is_unread).toBe(true);
    });
  });
});
