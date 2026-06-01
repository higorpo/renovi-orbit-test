// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatMessages } from "../useChatMessages";

vi.mock("@/features/auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/features/notifications", () => ({
  generateIdempotencyKeyV7: () => "00000000-0000-7000-8000-000000000003",
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn(), distribution: vi.fn() },
}));

const listChatMessagesMock = vi.fn();
const sendMessageMock = vi.fn();

vi.mock("../../api/chats.api", () => ({
  listChatMessages: (...args: unknown[]) => listChatMessagesMock(...args),
  sendMessage: (...args: unknown[]) => sendMessageMock(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listChatMessagesMock.mockResolvedValue({
    data: {
      items: [
        {
          id: "msg-1",
          chat_id: "chat-1",
          sender_user_id: "user-2",
          message_type: "TEXT",
          payload: { text: "Oi" },
          linked_entity_type: null,
          linked_entity_id: null,
          idempotency_key: "k1",
          delivery_status: "SENT",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      has_more: false,
      next_cursor: null,
    },
    error: null,
  });
});

describe("useChatMessages", () => {
  it("loads messages in ascending order", async () => {
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.id).toBe("msg-1");
  });

  it("adds optimistic message then clears after send success", async () => {
    sendMessageMock.mockResolvedValue({
      data: {
        message: {
          id: "msg-2",
          chat_id: "chat-1",
          sender_user_id: "user-1",
          message_type: "TEXT",
          payload: { text: "Olá" },
          idempotency_key: "00000000-0000-7000-8000-000000000003",
          created_at: "2026-01-02T00:00:00.000Z",
        },
        conversation: { id: "chat-1", last_interaction_at: "2026-01-02T00:00:00.000Z" },
      },
      error: null,
    });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.sendChatMessage({
      clientSendId: "client-1",
      messageType: "TEXT",
      payload: { text: "Olá" },
    });

    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "00000000-0000-7000-8000-000000000003",
      }),
    );
  });

  it("reuses idempotency key on retry after failure", async () => {
    sendMessageMock
      .mockResolvedValueOnce({ data: null, error: { code: "RATE_LIMITED", message: "Aguarde" } })
      .mockResolvedValueOnce({
        data: {
          message: {
            id: "msg-2",
            chat_id: "chat-1",
            sender_user_id: "user-1",
            message_type: "TEXT",
            payload: { text: "Olá" },
            idempotency_key: "00000000-0000-7000-8000-000000000003",
            created_at: "2026-01-02T00:00:00.000Z",
          },
          conversation: { id: "chat-1" },
        },
        error: null,
      });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.sendChatMessage({
        clientSendId: "client-1",
        messageType: "TEXT",
        payload: { text: "Olá" },
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });

    await result.current.retrySend("client-1");

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock.mock.calls[0]?.[0]?.idempotencyKey).toBe(
      sendMessageMock.mock.calls[1]?.[0]?.idempotencyKey,
    );
  });

  it("exposes rate-limit retry metadata on sendError for 429 UI", async () => {
    sendMessageMock.mockResolvedValue({
      data: null,
      error: {
        code: "RATE_LIMITED",
        message: "Muitas mensagens. Tente em 15s.",
        retryAfterSeconds: 15,
      },
    });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.sendChatMessage({
        clientSendId: "client-rate",
        messageType: "TEXT",
        payload: { text: "Oi" },
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 15 });

    await waitFor(() =>
      expect(result.current.sendError).toMatchObject({
        code: "RATE_LIMITED",
        retryAfterSeconds: 15,
      }),
    );
  });

  it("merges older pages without duplicate ids", async () => {
    const newestPage = {
      items: [
        {
          id: "msg-2",
          chat_id: "chat-1",
          sender_user_id: "user-2",
          message_type: "TEXT" as const,
          payload: { text: "Mais recente" },
          linked_entity_type: null,
          linked_entity_id: null,
          idempotency_key: "k2",
          delivery_status: "SENT" as const,
          created_at: "2026-01-02T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      has_more: true,
      next_cursor: { created_at: "2026-01-02T00:00:00.000Z", id: "msg-2" },
    };
    const olderPage = {
      items: [
        {
          id: "msg-1",
          chat_id: "chat-1",
          sender_user_id: "user-2",
          message_type: "TEXT" as const,
          payload: { text: "Oi" },
          linked_entity_type: null,
          linked_entity_id: null,
          idempotency_key: "k1",
          delivery_status: "SENT" as const,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "msg-2",
          chat_id: "chat-1",
          sender_user_id: "user-2",
          message_type: "TEXT" as const,
          payload: { text: "Mais recente" },
          linked_entity_type: null,
          linked_entity_id: null,
          idempotency_key: "k2",
          delivery_status: "SENT" as const,
          created_at: "2026-01-02T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
        },
      ],
      has_more: false,
      next_cursor: null,
    };

    listChatMessagesMock.mockReset();
    listChatMessagesMock.mockImplementation(async (params: { cursor?: unknown }) => {
      if (!params?.cursor) {
        return { data: newestPage, error: null };
      }
      return { data: olderPage, error: null };
    });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    await waitFor(() =>
      expect(result.current.messages.map((m) => m.id)).toEqual(["msg-1", "msg-2"]),
    );
  });

  it("merges gap-fill messages into the first page", async () => {
    listChatMessagesMock
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "msg-1",
              chat_id: "chat-1",
              sender_user_id: "user-2",
              message_type: "TEXT",
              payload: { text: "Oi" },
              linked_entity_type: null,
              linked_entity_id: null,
              idempotency_key: "k1",
              delivery_status: "SENT",
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          ],
          has_more: false,
          next_cursor: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "msg-2",
              chat_id: "chat-1",
              sender_user_id: "user-2",
              message_type: "TEXT",
              payload: { text: "Novo" },
              linked_entity_type: null,
              linked_entity_id: null,
              idempotency_key: "k2",
              delivery_status: "SENT",
              created_at: "2026-01-02T00:00:00.000Z",
              updated_at: "2026-01-02T00:00:00.000Z",
            },
          ],
          has_more: false,
          next_cursor: null,
        },
        error: null,
      });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await result.current.refetchGapFill();

    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(["msg-1", "msg-2"]));
    expect(listChatMessagesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chatId: "chat-1",
        after: true,
        cursor: { created_at: "2026-01-01T00:00:00.000Z", id: "msg-1" },
      }),
    );
  });
});
