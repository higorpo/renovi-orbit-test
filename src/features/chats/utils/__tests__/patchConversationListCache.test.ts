import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { CHAT_CONVERSATIONS_LIST_QUERY_KEY } from "../../constants/queryKeys";
import type { ConversationListItem, ConversationListResponse } from "../../types/chats.types";
import {
  clearConversationUnreadInListCache,
  patchConversationListCache,
} from "../patchConversationListCache";

const baseItem: ConversationListItem = {
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
  is_unread: true,
  last_read_at: null,
};

const otherItem: ConversationListItem = {
  ...baseItem,
  id: "chat-2",
  last_interaction_at: "2026-01-01T09:30:00.000Z",
};

function seedList(queryClient: QueryClient, items: ConversationListItem[]) {
  queryClient.setQueryData([CHAT_CONVERSATIONS_LIST_QUERY_KEY, 20], {
    pages: [{ items, has_more: false, next_cursor: null } satisfies ConversationListResponse],
    pageParams: [null],
  });
}

describe("patchConversationListCache", () => {
  it("updates preview, timestamp, unread state and moves chat to top", () => {
    const queryClient = new QueryClient();
    seedList(queryClient, [otherItem, baseItem]);

    const patched = patchConversationListCache(queryClient, {
      chatId: "chat-1",
      lastInteractionAt: "2026-01-01T11:00:00.000Z",
      lastMessage: {
        id: "msg-new",
        messageType: "TEXT",
        createdAt: "2026-01-01T11:00:00.000Z",
        payload: { text: "Nova mensagem" },
      },
      markAsRead: true,
    });

    expect(patched).toBe(true);

    const data = queryClient.getQueryData<{ pages: ConversationListResponse[] }>([
      CHAT_CONVERSATIONS_LIST_QUERY_KEY,
      20,
    ]);
    const items = data?.pages[0]?.items ?? [];

    expect(items[0]?.id).toBe("chat-1");
    expect(items[0]?.last_message?.preview_text).toBe("Nova mensagem");
    expect(items[0]?.last_interaction_at).toBe("2026-01-01T11:00:00.000Z");
    expect(items[0]?.is_unread).toBe(false);
    expect(items[1]?.id).toBe("chat-2");
  });

  it("marks conversation unread for counterparty messages", () => {
    const queryClient = new QueryClient();
    seedList(queryClient, [baseItem]);

    patchConversationListCache(queryClient, {
      chatId: "chat-1",
      lastInteractionAt: "2026-01-01T11:00:00.000Z",
      lastMessage: {
        id: "msg-new",
        messageType: "TEXT",
        createdAt: "2026-01-01T11:00:00.000Z",
        payload: { text: "Chegou agora" },
      },
      markAsUnread: true,
    });

    const data = queryClient.getQueryData<{ pages: ConversationListResponse[] }>([
      CHAT_CONVERSATIONS_LIST_QUERY_KEY,
      20,
    ]);

    expect(data?.pages[0]?.items[0]?.is_unread).toBe(true);
    expect(data?.pages[0]?.items[0]?.last_message?.preview_text).toBe("Chegou agora");
  });

  it("returns false when chat is not in the loaded pages", () => {
    const queryClient = new QueryClient();
    seedList(queryClient, [otherItem]);

    const patched = patchConversationListCache(queryClient, {
      chatId: "chat-1",
      lastInteractionAt: "2026-01-01T11:00:00.000Z",
      lastMessage: {
        id: "msg-new",
        messageType: "TEXT",
        createdAt: "2026-01-01T11:00:00.000Z",
        payload: { text: "Nova mensagem" },
      },
    });

    expect(patched).toBe(false);
  });

  it("returns false when list cache has no pages", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData([CHAT_CONVERSATIONS_LIST_QUERY_KEY, 20], {
      pages: [],
      pageParams: [],
    });

    expect(
      patchConversationListCache(queryClient, {
        chatId: "chat-1",
        lastInteractionAt: "2026-01-01T11:00:00.000Z",
        lastMessage: {
          id: "msg-new",
          messageType: "TEXT",
          createdAt: "2026-01-01T11:00:00.000Z",
          payload: { text: "Oi" },
        },
      }),
    ).toBe(false);
  });

  it.each([
    ["IMAGE", {}, "📷 Foto"],
    ["AUDIO", {}, "🎤 Áudio"],
    ["PROPOSAL", {}, "📋 Proposta"],
    ["SYSTEM", { text: "  Sistema  " }, "Sistema"],
    ["SYSTEM", {}, "Mensagem do sistema"],
    ["WORKFLOW_ACTION", { text: "  Atualizou  " }, "Atualizou"],
    ["WORKFLOW_ACTION", {}, "Atualização"],
    ["TEXT", {}, "Nova mensagem"],
    ["TEXT", { text: "a".repeat(130) }, "a".repeat(120)],
  ] as const)(
    "builds inbox preview for %s messages",
    (messageType, payload, preview) => {
      const queryClient = new QueryClient();
      seedList(queryClient, [baseItem]);

      patchConversationListCache(queryClient, {
        chatId: "chat-1",
        lastInteractionAt: "2026-01-01T11:00:00.000Z",
        lastMessage: {
          id: "msg-preview",
          messageType,
          createdAt: "2026-01-01T11:00:00.000Z",
          payload: { ...payload },
          linkedEntityType: "proposal",
          linkedEntityId: "prop-1",
        },
      });

      const data = queryClient.getQueryData<{ pages: ConversationListResponse[] }>([
        CHAT_CONVERSATIONS_LIST_QUERY_KEY,
        20,
      ]);
      const lastMessage = data?.pages[0]?.items[0]?.last_message;

      expect(lastMessage?.preview_text).toBe(preview);
      expect(lastMessage?.linked_entity_type).toBe("proposal");
      expect(lastMessage?.linked_entity_id).toBe("prop-1");
    },
  );

  it("reactivates conversation status and clears inactivated_at", () => {
    const queryClient = new QueryClient();
    seedList(queryClient, [
      {
        ...baseItem,
        status: "INACTIVE",
        inactivated_at: "2026-01-02T08:00:00.000Z",
      },
    ]);

    patchConversationListCache(queryClient, {
      chatId: "chat-1",
      lastInteractionAt: "2026-01-01T11:00:00.000Z",
      status: "ACTIVE",
      lastMessage: {
        id: "msg-new",
        messageType: "TEXT",
        createdAt: "2026-01-01T11:00:00.000Z",
        payload: { text: "Voltei" },
      },
    });

    const data = queryClient.getQueryData<{ pages: ConversationListResponse[] }>([
      CHAT_CONVERSATIONS_LIST_QUERY_KEY,
      20,
    ]);

    expect(data?.pages[0]?.items[0]?.status).toBe("ACTIVE");
    expect(data?.pages[0]?.items[0]?.inactivated_at).toBeNull();
  });

  it("rebuilds items across multiple infinite pages", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData([CHAT_CONVERSATIONS_LIST_QUERY_KEY, 20], {
      pages: [
        {
          items: [otherItem],
          has_more: true,
          next_cursor: "c1",
        } satisfies ConversationListResponse,
        {
          items: [baseItem],
          has_more: false,
          next_cursor: null,
        } satisfies ConversationListResponse,
      ],
      pageParams: [null, "c1"],
    });

    patchConversationListCache(queryClient, {
      chatId: "chat-1",
      lastInteractionAt: "2026-01-01T12:00:00.000Z",
      lastMessage: {
        id: "msg-top",
        messageType: "TEXT",
        createdAt: "2026-01-01T12:00:00.000Z",
        payload: { text: "Topo" },
      },
    });

    const data = queryClient.getQueryData<{ pages: ConversationListResponse[] }>([
      CHAT_CONVERSATIONS_LIST_QUERY_KEY,
      20,
    ]);

    expect(data?.pages[0]?.items[0]?.id).toBe("chat-1");
    expect(data?.pages[1]?.items[0]?.id).toBe("chat-2");
  });

  it("updates to a non-active status without clearing inactivation metadata", () => {
    const queryClient = new QueryClient();
    seedList(queryClient, [
      {
        ...baseItem,
        inactivated_at: "2026-01-02T08:00:00.000Z",
      },
    ]);

    patchConversationListCache(queryClient, {
      chatId: "chat-1",
      lastInteractionAt: "2026-01-02T09:00:00.000Z",
      status: "INACTIVE",
      lastMessage: {
        id: "msg-inactive",
        messageType: "SYSTEM",
        createdAt: "2026-01-02T09:00:00.000Z",
        payload: {},
      },
    });

    const data = queryClient.getQueryData<{ pages: ConversationListResponse[] }>([
      CHAT_CONVERSATIONS_LIST_QUERY_KEY,
      20,
    ]);
    expect(data?.pages[0]?.items[0]?.status).toBe("INACTIVE");
    expect(data?.pages[0]?.items[0]?.inactivated_at).toBe("2026-01-02T08:00:00.000Z");
  });
});

describe("clearConversationUnreadInListCache", () => {
  it("clears unread state without reordering or changing preview", () => {
    const queryClient = new QueryClient();
    seedList(queryClient, [otherItem, baseItem]);

    const patched = clearConversationUnreadInListCache(queryClient, {
      chatId: "chat-1",
      lastReadAt: "2026-01-01T10:30:00.000Z",
    });

    expect(patched).toBe(true);

    const data = queryClient.getQueryData<{ pages: ConversationListResponse[] }>([
      CHAT_CONVERSATIONS_LIST_QUERY_KEY,
      20,
    ]);
    const items = data?.pages[0]?.items ?? [];

    expect(items[0]?.id).toBe("chat-2");
    expect(items[1]?.id).toBe("chat-1");
    expect(items[1]?.is_unread).toBe(false);
    expect(items[1]?.last_read_at).toBe("2026-01-01T10:30:00.000Z");
    expect(items[1]?.last_message?.preview_text).toBe("Mensagem antiga");
  });

  it("returns false when chat is missing or already cleared", () => {
    const queryClient = new QueryClient();
    seedList(queryClient, [
      {
        ...baseItem,
        is_unread: false,
        last_read_at: "2026-01-01T10:30:00.000Z",
      },
    ]);

    expect(
      clearConversationUnreadInListCache(queryClient, {
        chatId: "chat-missing",
        lastReadAt: "2026-01-01T10:30:00.000Z",
      }),
    ).toBe(false);

    expect(
      clearConversationUnreadInListCache(queryClient, {
        chatId: "chat-1",
        lastReadAt: "2026-01-01T10:30:00.000Z",
      }),
    ).toBe(false);
  });

  it("returns false when list cache has no pages", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData([CHAT_CONVERSATIONS_LIST_QUERY_KEY, 20], {
      pages: [],
      pageParams: [],
    });

    expect(
      clearConversationUnreadInListCache(queryClient, {
        chatId: "chat-1",
        lastReadAt: "2026-01-01T10:30:00.000Z",
      }),
    ).toBe(false);
  });
});
