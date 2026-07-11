// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatMessages } from "../useChatMessages";

const authState = vi.hoisted(() => ({ user: { id: "user-1" } as { id: string } | null }));
vi.mock("@/features/auth", () => ({
  useAuth: () => ({ user: authState.user }),
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
const uploadChatAudioMock = vi.fn();

vi.mock("../../api/chatMedia.api", () => ({
  createMediaUploadSession: (...args: unknown[]) => createMediaUploadSessionMock(...args),
  uploadChatMedia: (...args: unknown[]) => uploadChatMediaMock(...args),
  uploadChatAudio: (...args: unknown[]) => uploadChatAudioMock(...args),
}));

const prepareChatImageFilesMock = vi.hoisted(() => vi.fn(async (files: File[]) => files));
vi.mock("../../utils/chatImagePrepare", () => ({
  prepareChatImageFiles: prepareChatImageFilesMock,
}));

const isNativePlatformMock = vi.hoisted(() => vi.fn(() => false));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: (...args: unknown[]) => isNativePlatformMock(...args) },
}));

const toastErrorMock = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
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
  authState.user = { id: "user-1" };
  idempotencySeq = 0;
  isNativePlatformMock.mockReturnValue(false);
  prepareChatImageFilesMock.mockImplementation(async (files: File[]) => files);
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

  it("exposes message loading errors", async () => {
    listChatMessagesMock.mockResolvedValue({
      data: null,
      error: { code: "UNKNOWN", message: "load failed" },
    });
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error("load failed"));
  });

  it("rejects sending and reports attachment auth errors without a user", async () => {
    authState.user = null;
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    const textInput = {
      clientSendId: "client-unauth",
      messageType: "TEXT" as const,
      payload: { text: "Oi" },
    };

    await expect(result.current.sendChatMessage(textInput)).rejects.toThrow(
      "Autenticação necessária",
    );
    result.current.sendChatImages([new File(["x"], "photo.jpg", { type: "image/jpeg" })]);
    result.current.sendChatAudio(
      new File(["audio"], "voice.webm", { type: "audio/webm" }),
      2_000,
    );

    expect(toastErrorMock).toHaveBeenCalledWith("Faça login para enviar imagens.");
    expect(toastErrorMock).toHaveBeenCalledWith("Faça login para enviar áudio.");
  });

  it("dismisses an optimistic image when upload session creation fails", async () => {
    createMediaUploadSessionMock.mockResolvedValue({
      data: null,
      error: { code: "UNKNOWN", message: "session failed" },
    });
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.sendChatImages([
      new File(["x"], "photo.jpg", { type: "image/jpeg" }),
    ]);

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("session failed"));
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
    expect(uploadChatMediaMock).not.toHaveBeenCalled();
  });

  it("dismisses an optimistic image when web preparation throws", async () => {
    prepareChatImageFilesMock.mockRejectedValueOnce(new Error("conversion failed"));
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.sendChatImages([
      new File(["x"], "photo.jpg", { type: "image/jpeg" }),
    ]);

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("conversion failed"));
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
  });

  it("uploads and sends a valid audio message", async () => {
    createMediaUploadSessionMock.mockResolvedValue({
      data: { upload_session_id: "audio-session" },
      error: null,
    });
    uploadChatAudioMock.mockResolvedValue({
      path: "chat/audio-session/voice.webm",
      error: null,
    });
    sendMessageMock.mockResolvedValue({
      data: {
        message: {
          id: "msg-audio",
          chat_id: "chat-1",
          sender_user_id: "user-1",
          message_type: "AUDIO",
          payload: { path: "chat/audio-session/voice.webm" },
          idempotency_key: "key",
          created_at: "2026-01-02T00:00:00.000Z",
        },
        conversation: {
          id: "chat-1",
          status: "ACTIVE",
          last_interaction_at: "2026-01-02T00:00:00.000Z",
        },
      },
      error: null,
    });
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const file = new File(["audio"], "voice.webm", { type: "audio/webm" });

    result.current.sendChatAudio(file, 2_000);

    await waitFor(() => expect(sendMessageMock).toHaveBeenCalled());
    expect(uploadChatAudioMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "chat-1",
        uploadSessionId: "audio-session",
        file,
      }),
    );
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: "AUDIO",
        payload: expect.objectContaining({
          path: "chat/audio-session/voice.webm",
          duration_ms: 2_000,
        }),
      }),
    );
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
  });

  it("validates audio and dismisses failed audio uploads", async () => {
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const file = new File(["audio"], "voice.webm", { type: "audio/webm" });

    result.current.sendChatAudio(file, 100);
    expect(toastErrorMock).toHaveBeenCalledWith("Grave pelo menos 1 segundo de áudio.");

    createMediaUploadSessionMock.mockResolvedValue({
      data: { upload_session_id: "audio-session" },
      error: null,
    });
    uploadChatAudioMock.mockResolvedValue({ path: null, error: "upload failed" });
    result.current.sendChatAudio(file, 2_000);

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("upload failed"));
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
  });

  it("dismisses a failed optimistic send and clears its error", async () => {
    sendMessageMock.mockResolvedValue({
      data: null,
      error: { code: "RATE_LIMITED", message: "wait" },
    });
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.sendChatMessage({
        clientSendId: "client-dismiss",
        messageType: "TEXT",
        payload: { text: "Oi" },
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await waitFor(() => expect(result.current.optimisticCount).toBe(1));
    const optimistic = result.current.messages.find((message) =>
      message.id.startsWith("optimistic:"),
    );

    result.current.dismissFailedSend(optimistic!.idempotency_key);

    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
    expect(result.current.sendError).toBeNull();
  });

  it("dismisses optimistic audio when session creation throws", async () => {
    createMediaUploadSessionMock.mockRejectedValueOnce(new Error("session boom"));
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const file = new File(["audio"], "voice.webm", { type: "audio/webm" });

    result.current.sendChatAudio(file, 2_000);

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("session boom"),
    );
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
  });

  it("no-ops retrySend when there is no pending input", async () => {
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.retrySend("missing-client-send")).toBeUndefined();
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("disables the messages query when enabled is false", async () => {
    const { result } = renderHook(() => useChatMessages("chat-1", { enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(listChatMessagesMock).not.toHaveBeenCalled();
  });

  it("rejects image validation before starting an upload", async () => {
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.sendChatImages([
      new File(["x"], "notes.txt", { type: "text/plain" }),
    ]);

    expect(toastErrorMock).toHaveBeenCalled();
    expect(createMediaUploadSessionMock).not.toHaveBeenCalled();
  });

  it("uses a multi-photo preview label and dismisses on upload failure", async () => {
    createMediaUploadSessionMock.mockResolvedValue({
      data: { upload_session_id: "session-1" },
      error: null,
    });
    uploadChatMediaMock.mockResolvedValue({ paths: [], error: "upload blocked" });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.sendChatImages([
      new File(["a"], "a.png", { type: "image/png" }),
      new File(["b"], "b.png", { type: "image/png" }),
    ]);

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("upload blocked"));
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
    expect(uploadChatMediaMock).toHaveBeenCalled();
  });

  it("toasts API-shaped image send failures without clearing optimistic state twice", async () => {
    createMediaUploadSessionMock.mockRejectedValue({
      code: "RATE_LIMITED",
      message: "Aguarde um momento",
    });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.sendChatImages([
      new File(["x"], "photo.jpg", { type: "image/jpeg" }),
    ]);

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Aguarde um momento"),
    );
  });

  it("dismisses optimistic audio when session creation returns an error payload", async () => {
    createMediaUploadSessionMock.mockResolvedValue({
      data: null,
      error: { code: "UNKNOWN", message: "audio session failed" },
    });
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.sendChatAudio(
      new File(["audio"], "voice.webm", { type: "audio/webm" }),
      2_000,
    );

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("audio session failed"),
    );
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
  });

  it("maps non-API send errors to UNKNOWN sendError", async () => {
    sendMessageMock.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.sendChatMessage({
        clientSendId: "client-unknown",
        messageType: "TEXT",
        payload: { text: "Oi" },
      }),
    ).rejects.toThrow("boom");

    await waitFor(() =>
      expect(result.current.sendError).toMatchObject({
        code: "UNKNOWN",
        message: "boom",
      }),
    );
  });

  it("falls back to a generic sendError message for non-Error throws", async () => {
    sendMessageMock.mockRejectedValue("plain-failure");
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.sendChatMessage({
        clientSendId: "client-plain",
        messageType: "TEXT",
        payload: { text: "Oi" },
      }),
    ).rejects.toBe("plain-failure");

    await waitFor(() =>
      expect(result.current.sendError).toMatchObject({
        code: "UNKNOWN",
        message: "Erro ao enviar mensagem",
      }),
    );
  });

  it("logs and continues when forward gap fill fails", async () => {
    const { logger } = await import("@/lib/logger");
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
        data: null,
        error: { code: "UNKNOWN", message: "gap failed" },
      })
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
      });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await result.current.refetchGapFill();

    expect(logger.warn).toHaveBeenCalledWith(
      "chat_messages_gap_fill_failed",
      expect.objectContaining({ chatId: "chat-1" }),
    );
  });

  it("uses a caption when provided for image sends", async () => {
    createMediaUploadSessionMock.mockResolvedValue({
      data: { upload_session_id: "session-1" },
      error: null,
    });
    uploadChatMediaMock.mockResolvedValue({
      paths: ["chat/s/a.png"],
      error: null,
    });
    sendMessageMock.mockResolvedValue({
      data: {
        message: {
          id: "msg-img",
          chat_id: "chat-1",
          sender_user_id: "user-1",
          message_type: "IMAGE",
          payload: { paths: ["chat/s/a.png"], preview: "Minha foto" },
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

    result.current.sendChatImages(
      [new File(["x"], "shot.png", { type: "image/png" })],
      "  Minha foto  ",
    );

    await waitFor(() => expect(sendMessageMock).toHaveBeenCalled());
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ preview: "Minha foto" }),
      }),
    );
  });

  it("dismisses optimistic image when prepared files fail validation", async () => {
    prepareChatImageFilesMock.mockResolvedValueOnce([
      new File(["x"], "notes.txt", { type: "text/plain" }),
    ]);
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.sendChatImages([
      new File(["x"], "photo.jpg", { type: "image/jpeg" }),
    ]);

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
    expect(createMediaUploadSessionMock).not.toHaveBeenCalled();
  });

  it("no-ops gap fill when chatId is null", async () => {
    const { result } = renderHook(() => useChatMessages(null), {
      wrapper: createWrapper(),
    });

    await result.current.refetchGapFill();
    expect(listChatMessagesMock).not.toHaveBeenCalled();
  });

  it("skips prepareChatImageFiles on native platforms", async () => {
    isNativePlatformMock.mockReturnValue(true);
    createMediaUploadSessionMock.mockResolvedValue({
      data: { upload_session_id: "native-session" },
      error: null,
    });
    uploadChatMediaMock.mockResolvedValue({
      paths: ["chat/s/a.png"],
      error: null,
    });
    sendMessageMock.mockResolvedValue({
      data: {
        message: {
          id: "msg-native",
          chat_id: "chat-1",
          sender_user_id: "user-1",
          message_type: "IMAGE",
          payload: { paths: ["chat/s/a.png"], preview: "Foto" },
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

    await waitFor(() => expect(sendMessageMock).toHaveBeenCalled());
    expect(prepareChatImageFilesMock).not.toHaveBeenCalled();
  });

  it("uses default list error message when error payload is missing", async () => {
    listChatMessagesMock.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error("Erro ao carregar mensagens"));
  });

  it("uses default audio session toast when error payload is missing", async () => {
    createMediaUploadSessionMock.mockResolvedValue({
      data: null,
      error: null,
    });
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.sendChatAudio(
      new File(["audio"], "voice.webm", { type: "audio/webm" }),
      2_000,
    );

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Não foi possível preparar o envio."),
    );
  });

  it("logs tail refresh failures after empty forward gap fill", async () => {
    const { logger } = await import("@/lib/logger");
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
        data: { items: [], has_more: false, next_cursor: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "UNKNOWN", message: "tail failed" },
      });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await result.current.refetchGapFill();

    expect(logger.warn).toHaveBeenCalledWith(
      "chat_messages_tail_refresh_failed",
      expect.objectContaining({ chatId: "chat-1" }),
    );
  });

  it("does not fetch messages when user is null", async () => {
    authState.user = null;
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(listChatMessagesMock).not.toHaveBeenCalled();
  });

  it("records send success metrics and invalidates list when patch misses", async () => {
    const { metrics } = await import("@/lib/sentry");
    const { logger } = await import("@/lib/logger");
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
        conversation: {
          id: "chat-1",
          status: "ACTIVE",
          last_interaction_at: "2026-01-02T00:00:00.000Z",
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.sendChatMessage({
      clientSendId: "client-metrics",
      messageType: "TEXT",
      payload: { text: "Olá" },
    });

    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
    expect(metrics.distribution).toHaveBeenCalledWith(
      "chats.send_message_duration_ms",
      expect.any(Number),
      expect.objectContaining({ message_type: "TEXT" }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "chat_message_sent",
      expect.objectContaining({ chatId: "chat-1", messageId: "msg-2" }),
    );
  });

  it("increments send_message_failed metric when send returns an API error", async () => {
    const { metrics } = await import("@/lib/sentry");
    sendMessageMock.mockResolvedValue({
      data: null,
      error: { code: "RATE_LIMITED", message: "wait" },
    });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.sendChatMessage({
        clientSendId: "client-fail-metric",
        messageType: "TEXT",
        payload: { text: "Oi" },
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });

    expect(metrics.count).toHaveBeenCalledWith(
      "chats.send_message_failed",
      1,
      expect.objectContaining({ code: "RATE_LIMITED" }),
    );
  });

  it("throws generic Error when send returns no data and no error object", async () => {
    const { metrics } = await import("@/lib/sentry");
    sendMessageMock.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.sendChatMessage({
        clientSendId: "client-empty",
        messageType: "TEXT",
        payload: { text: "Oi" },
      }),
    ).rejects.toThrow("Erro ao enviar mensagem");

    expect(metrics.count).toHaveBeenCalledWith(
      "chats.send_message_failed",
      1,
      expect.objectContaining({ code: "UNKNOWN" }),
    );
  });

  it("revokes blob preview URLs when chatId changes", async () => {
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    createMediaUploadSessionMock.mockImplementation(() => new Promise(() => {}));

    const { result, rerender } = renderHook(
      ({ activeChatId }: { activeChatId: string }) => useChatMessages(activeChatId),
      {
        wrapper: createWrapper(),
        initialProps: { activeChatId: "chat-1" },
      },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.sendChatImages([
      new File(["x"], "photo.jpg", { type: "image/jpeg" }),
    ]);
    await waitFor(() => expect(result.current.optimisticCount).toBe(1));

    rerender({ activeChatId: "chat-2" });
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
    expect(revokeSpy).toHaveBeenCalled();
    revokeSpy.mockRestore();
  });

  it("uses default image session toast when error payload is missing", async () => {
    createMediaUploadSessionMock.mockResolvedValue({
      data: null,
      error: null,
    });
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.sendChatImages([
      new File(["x"], "photo.jpg", { type: "image/jpeg" }),
    ]);

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Não foi possível preparar o envio."),
    );
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
  });

  it("toasts generic image message for non-Error throws", async () => {
    prepareChatImageFilesMock.mockRejectedValueOnce("plain-image-failure");
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.sendChatImages([
      new File(["x"], "photo.jpg", { type: "image/jpeg" }),
    ]);

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Não foi possível enviar a imagem."),
    );
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
  });

  it("toasts generic audio message for non-Error throws", async () => {
    createMediaUploadSessionMock.mockRejectedValueOnce("plain-audio-failure");
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.sendChatAudio(
      new File(["audio"], "voice.webm", { type: "audio/webm" }),
      2_000,
    );

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Não foi possível enviar o áudio."),
    );
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
  });

  it("exposes isSending while a send is in flight", async () => {
    let resolveSend!: (value: unknown) => void;
    sendMessageMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const pending = result.current.sendChatMessage({
      clientSendId: "client-inflight",
      messageType: "TEXT",
      payload: { text: "Oi" },
    });

    await waitFor(() => expect(result.current.isSending).toBe(true));
    expect(result.current.pendingSendCount).toBeGreaterThan(0);

    resolveSend({
      data: {
        message: {
          id: "msg-inflight",
          chat_id: "chat-1",
          sender_user_id: "user-1",
          message_type: "TEXT",
          payload: { text: "Oi" },
          idempotency_key: "00000000-0000-7000-8000-000000000001",
          created_at: "2026-01-02T00:00:00.000Z",
        },
        conversation: { id: "chat-1", last_interaction_at: "2026-01-02T00:00:00.000Z" },
      },
      error: null,
    });
    await pending;
    await waitFor(() => expect(result.current.isSending).toBe(false));
  });

  it("continues the send chain after a failed send", async () => {
    sendMessageMock
      .mockResolvedValueOnce({
        data: null,
        error: { code: "RATE_LIMITED", message: "wait" },
      })
      .mockResolvedValueOnce({
        data: {
          message: {
            id: "msg-second",
            chat_id: "chat-1",
            sender_user_id: "user-1",
            message_type: "TEXT",
            payload: { text: "segunda" },
            idempotency_key: "00000000-0000-7000-8000-000000000002",
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

    await expect(
      result.current.sendChatMessage({
        clientSendId: "client-first-fail",
        messageType: "TEXT",
        payload: { text: "primeira" },
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });

    await result.current.sendChatMessage({
      clientSendId: "client-second-ok",
      messageType: "TEXT",
      payload: { text: "segunda" },
    });

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(result.current.messages.some((m) => m.id === "msg-second")).toBe(true),
    );
  });

  it("uses single-photo preview label Foto without caption", async () => {
    createMediaUploadSessionMock.mockResolvedValue({
      data: { upload_session_id: "session-1" },
      error: null,
    });
    uploadChatMediaMock.mockResolvedValue({
      paths: ["chat/s/a.png"],
      error: null,
    });
    sendMessageMock.mockResolvedValue({
      data: {
        message: {
          id: "msg-img",
          chat_id: "chat-1",
          sender_user_id: "user-1",
          message_type: "IMAGE",
          payload: { paths: ["chat/s/a.png"], preview: "Foto" },
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

    await waitFor(() => expect(sendMessageMock).toHaveBeenCalled());
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ preview: "Foto" }),
      }),
    );
  });

  it("uses default audio upload toast when path and error are missing", async () => {
    createMediaUploadSessionMock.mockResolvedValue({
      data: { upload_session_id: "audio-session" },
      error: null,
    });
    uploadChatAudioMock.mockResolvedValue({ path: null, error: null });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.sendChatAudio(
      new File(["audio"], "voice.webm", { type: "audio/webm" }),
      2_000,
    );

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Não foi possível enviar o áudio."),
    );
    await waitFor(() => expect(result.current.optimisticCount).toBe(0));
  });

  it("no-ops retrySend when user becomes null", async () => {
    sendMessageMock.mockResolvedValue({
      data: null,
      error: { code: "RATE_LIMITED", message: "wait" },
    });
    const { result, rerender } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.sendChatMessage({
        clientSendId: "client-retry-unauth",
        messageType: "TEXT",
        payload: { text: "Oi" },
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });

    authState.user = null;
    rerender();
    sendMessageMock.mockClear();
    expect(result.current.retrySend("client-retry-unauth")).toBeUndefined();
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("no-ops dismissFailedSend when the idempotency key is unknown", async () => {
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.dismissFailedSend("missing-key");
    expect(result.current.optimisticCount).toBe(0);
    expect(result.current.sendError).toBeNull();
  });

  it("uses default image API toast when error object has no message", async () => {
    createMediaUploadSessionMock.mockRejectedValue({
      code: "RATE_LIMITED",
    });

    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.sendChatImages([
      new File(["x"], "photo.jpg", { type: "image/jpeg" }),
    ]);

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Não foi possível enviar a mensagem com a imagem.",
      ),
    );
  });

  it("rejects sendChatMessage when user is null", async () => {
    authState.user = null;
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.sendChatMessage({
        clientSendId: "client-unauth",
        messageType: "TEXT",
        payload: { text: "Oi" },
      }),
    ).rejects.toThrow("Autenticação necessária para enviar mensagem");
  });

  it("skips gap fill merge when list query has not produced pages yet", async () => {
    listChatMessagesMock.mockResolvedValueOnce({
      data: null,
      error: { code: "UNKNOWN", message: "boot" },
    });
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    listChatMessagesMock.mockClear();
    listChatMessagesMock.mockResolvedValue({
      data: { items: [], has_more: false, next_cursor: null },
      error: null,
    });

    await result.current.refetchGapFill();
    expect(listChatMessagesMock).toHaveBeenCalled();
  });

  it("continues the retry send chain after another retry failure", async () => {
    sendMessageMock.mockResolvedValue({
      data: null,
      error: { code: "RATE_LIMITED", message: "wait" },
    });
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.sendChatMessage({
        clientSendId: "client-retry-fails",
        messageType: "TEXT",
        payload: { text: "Oi" },
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(
      result.current.retrySend("client-retry-fails")
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
  });

  it("tail-refreshes when the ready cache contains no confirmed message", async () => {
    listChatMessagesMock
      .mockResolvedValueOnce({
        data: { items: [], has_more: false, next_cursor: null },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "msg-tail",
              chat_id: "chat-1",
              sender_user_id: "user-2",
              message_type: "TEXT",
              payload: { text: "Tail" },
              linked_entity_type: null,
              linked_entity_id: null,
              idempotency_key: "tail-key",
              delivery_status: "SENT",
              created_at: "2026-01-03T00:00:00.000Z",
              updated_at: "2026-01-03T00:00:00.000Z",
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

    await waitFor(() =>
      expect(result.current.messages.map((message) => message.id)).toEqual([
        "msg-tail",
      ])
    );
    expect(listChatMessagesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: false, cursor: null })
    );
  });

  it("keeps unrelated optimistic sends when dismissing one failed key", async () => {
    sendMessageMock.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useChatMessages("chat-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    void result.current.sendChatMessage({
      clientSendId: "client-first",
      messageType: "TEXT",
      payload: { text: "First" },
    });
    void result.current.sendChatMessage({
      clientSendId: "client-second",
      messageType: "TEXT",
      payload: { text: "Second" },
    });
    await waitFor(() => expect(result.current.optimisticCount).toBe(2));
    const firstKey = result.current.messages.find(
      (message) => message.payload.text === "First"
    )!.idempotency_key;

    result.current.dismissFailedSend(firstKey);

    await waitFor(() => expect(result.current.optimisticCount).toBe(1));
    expect(
      result.current.messages.some(
        (message) => message.payload.text === "Second"
      )
    ).toBe(true);
  });
});
