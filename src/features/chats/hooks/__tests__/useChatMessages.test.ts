// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatMessages } from "../useChatMessages";

vi.mock("@/features/auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

let idempotencySeq = 0;
vi.mock("@/lib/utils/idempotencyKey", () => ({
  generateIdempotencyKeyV7: () => {
    idempotencySeq += 1;
    return `00000000-0000-7000-8000-00000000000${idempotencySeq}`;
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn(), distribution: vi.fn() },
}));

vi.mock("../../utils/clientSendId", () => ({
  createClientSendId: () => "client-image-1",
}));

const listChatMessagesMock = vi.fn();
const sendMessageMock = vi.fn();

vi.mock("../../api/chats.api", () => ({
  listChatMessages: (...args: unknown[]) => listChatMessagesMock(...args),
  sendMessage: (...args: unknown[]) => sendMessageMock(...args),
}));

const createMediaUploadSessionMock = vi.fn();
const uploadChatMediaMock = vi.fn();

vi.mock("../../api/chatMedia.api", () => ({
  createMediaUploadSession: (...args: unknown[]) => createMediaUploadSessionMock(...args),
  uploadChatMedia: (...args: unknown[]) => uploadChatMediaMock(...args),
}));

vi.mock("../../utils/chatImagePrepare", () => ({
  prepareChatImageFiles: vi.fn(async (files: File[]) => files),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
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
  idempotencySeq = 0;
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
          idempotency_key: "00000000-0000-7000-8000-000000000001",
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
        idempotencyKey: "00000000-0000-7000-8000-000000000001",
      }),
    );
  });

  it("shows optimistic image in timeline immediately while upload runs", async () => {
    let resolveUpload!: (value: { paths: string[]; error: null }) => void;
    const uploadDeferred = new Promise<{ paths: string[]; error: null }>((resolve) => {
      resolveUpload = resolve;
    });

    createMediaUploadSessionMock.mockResolvedValue({
      data: { upload_session_id: "session-1" },
      error: null,
    });
    uploadChatMediaMock.mockReturnValue(uploadDeferred);

    sendMessageMock.mockResolvedValue({
      data: {
        message: {
          id: "msg-img",
          chat_id: "chat-1",
          sender_user_id: "user-1",
          message_type: "IMAGE",
          payload: {
            paths: ["chat/s/a.png"],
            preview: "Foto",
          },
          idempotency_key: "00000000-0000-7000-8000-000000000001",
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

    const file = new File(["x"], "shot.png", { type: "image/png" });
    result.current.sendChatImages([file]);

    await waitFor(() => {
      const optimistic = result.current.messages.find((m) => m.id.startsWith("optimistic:"));
      expect(optimistic?.message_type).toBe("IMAGE");
      expect(optimistic?.delivery_status).toBe("PENDING");
      expect(optimistic?.payload.local_preview_urls).toHaveLength(1);
    });

    resolveUpload({ paths: ["chat/s/a.png"], error: null });
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: "IMAGE",
        payload: expect.objectContaining({
          upload_session_id: "session-1",
          paths: ["chat/s/a.png"],
        }),
      }),
    );
  });

  it("retry after image send failure does not send local_preview_urls to the server", async () => {
    createMediaUploadSessionMock.mockResolvedValue({
      data: { upload_session_id: "session-1" },
      error: null,
    });
    uploadChatMediaMock.mockResolvedValue({
      paths: ["chat/s/a.png"],
      error: null,
    });

    sendMessageMock
      .mockResolvedValueOnce({ data: null, error: { code: "RATE_LIMITED", message: "Aguarde" } })
      .mockResolvedValueOnce({
        data: {
          message: {
            id: "msg-img",
            chat_id: "chat-1",
            sender_user_id: "user-1",
            message_type: "IMAGE",
            payload: {
              paths: ["chat/s/a.png"],
              preview: "Foto",
            },
            idempotency_key: "00000000-0000-7000-8000-000000000001",
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

    result.current.sendChatImages([new File(["x"], "shot.png", { type: "image/png" })]);

    await waitFor(() => expect(sendMessageMock).toHaveBeenCalledTimes(1));
    expect(sendMessageMock.mock.calls[0]?.[0]?.payload).not.toHaveProperty("local_preview_urls");

    await result.current.retrySend("client-image-1");

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock.mock.calls[1]?.[0]?.payload).not.toHaveProperty("local_preview_urls");
    expect(sendMessageMock.mock.calls[1]?.[0]?.payload).toMatchObject({
      upload_session_id: "session-1",
      paths: ["chat/s/a.png"],
    });
  });

  it("clears optimistic rows when chatId changes", async () => {
    sendMessageMock.mockImplementation(() => new Promise(() => {}));

    const { result, rerender } = renderHook(
      ({ activeChatId }: { activeChatId: string }) => useChatMessages(activeChatId),
      {
        wrapper: createWrapper(),
        initialProps: { activeChatId: "chat-1" },
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    void result.current.sendChatMessage({
      clientSendId: "client-1",
      messageType: "TEXT",
      payload: { text: "pendente" },
    });

    await waitFor(() => expect(result.current.optimisticCount).toBe(1));

    rerender({ activeChatId: "chat-2" });

    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
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
            idempotency_key: "00000000-0000-7000-8000-000000000002",
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
      "00000000-0000-7000-8000-000000000001",
    );
    expect(sendMessageMock.mock.calls[1]?.[0]?.idempotencyKey).toBe(
      "00000000-0000-7000-8000-000000000001",
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

  it("sends queued messages to the API in enqueue order", async () => {
    const sendOrder: string[] = [];
    let resolveFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    sendMessageMock.mockImplementation(
      async (params: { idempotencyKey: string; payload: { text: string } }) => {
        sendOrder.push(params.payload.text);
        if (params.payload.text === "primeira") await firstGate;
        return {
          data: {
            message: {
              id: `msg-${params.payload.text}`,
              chat_id: "chat-1",
              sender_user_id: "user-1",
              message_type: "TEXT",
              payload: params.payload,
              idempotency_key: params.idempotencyKey,
              created_at: "2026-01-02T00:00:00.000Z",
            },
            conversation: { id: "chat-1", last_interaction_at: "2026-01-02T00:00:00.000Z" },
          },
          error: null,
        };
      },
    );

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const first = result.current.sendChatMessage({
      clientSendId: "client-1",
      messageType: "TEXT",
      payload: { text: "primeira" },
    });
    const second = result.current.sendChatMessage({
      clientSendId: "client-2",
      messageType: "TEXT",
      payload: { text: "segunda" },
    });

    await waitFor(() => expect(sendOrder).toEqual(["primeira"]));
    resolveFirst?.();
    await Promise.all([first, second]);

    expect(sendOrder).toEqual(["primeira", "segunda"]);
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
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

  it("tail-refreshes when forward gap fill misses an older counterparty message", async () => {
    listChatMessagesMock
      .mockResolvedValueOnce({
        data: { items: [], has_more: false, next_cursor: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { items: [], has_more: false, next_cursor: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "msg-a",
              chat_id: "chat-1",
              sender_user_id: "user-2",
              message_type: "TEXT",
              payload: { text: "from A" },
              linked_entity_type: null,
              linked_entity_id: null,
              idempotency_key: "k-a",
              delivery_status: "SENT",
              created_at: "2026-01-01T00:00:00.100Z",
              updated_at: "2026-01-01T00:00:00.100Z",
            },
            {
              id: "msg-b",
              chat_id: "chat-1",
              sender_user_id: "user-1",
              message_type: "TEXT",
              payload: { text: "from B" },
              linked_entity_type: null,
              linked_entity_id: null,
              idempotency_key: "k-b",
              delivery_status: "SENT",
              created_at: "2026-01-01T00:00:00.200Z",
              updated_at: "2026-01-01T00:00:00.200Z",
            },
          ],
          has_more: false,
          next_cursor: null,
        },
        error: null,
      });

    sendMessageMock.mockResolvedValue({
      data: {
        message: {
          id: "msg-b",
          chat_id: "chat-1",
          sender_user_id: "user-1",
          message_type: "TEXT",
          payload: { text: "from B" },
          linked_entity_type: null,
          linked_entity_id: null,
          idempotency_key: "k-b",
          delivery_status: "SENT",
          created_at: "2026-01-01T00:00:00.200Z",
          updated_at: "2026-01-01T00:00:00.200Z",
        },
        conversation: { last_interaction_at: "2026-01-01T00:00:00.200Z" },
      },
      error: null,
    });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.sendChatMessage({
      clientSendId: "client-b",
      messageType: "TEXT",
      payload: { text: "from B" },
    });

    await waitFor(() =>
      expect(result.current.messages.map((m) => m.id)).toEqual(["msg-b"]),
    );

    listChatMessagesMock.mockClear();
    await result.current.refetchGapFill();

    await waitFor(() =>
      expect(result.current.messages.map((m) => m.id)).toEqual(["msg-a", "msg-b"]),
    );

    expect(listChatMessagesMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        after: true,
        cursor: { created_at: "2026-01-01T00:00:00.200Z", id: "msg-b" },
      }),
    );
    expect(listChatMessagesMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        after: false,
        cursor: null,
      }),
    );
  });
});
