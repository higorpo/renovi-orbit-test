import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeConversation,
  getConversationDetail,
  listChatMessages,
  listConversations,
  markConversationRead,
  sendMessage,
} from "../chats.api";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

vi.mock("@/lib/utils/idempotencyKey", () => ({
  generateIdempotencyKeyV7: () => "00000000-0000-7000-8000-000000000001",
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listConversations", () => {
  it("returns typed list payload on success", async () => {
    const payload = { items: [], has_more: false, next_cursor: null };
    rpcMock.mockResolvedValue({ data: payload, error: null });

    const result = await listConversations({ pageSize: 10 });
    expect(result.data).toEqual(payload);
    expect(result.error).toBeNull();
    expect(rpcMock).toHaveBeenCalledWith("list_conversations", {
      p_page_size: 10,
      p_cursor_last_interaction_at: null,
      p_cursor_id: null,
    });
  });

  it("maps business errors for UI", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "CONVERSATION_CLOSED", details: '{"code":"CONVERSATION_CLOSED"}' },
    });

    const result = await listConversations({});
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("CONVERSATION_CLOSED");
    expect(result.error?.message).toContain("encerrada");
  });
});

describe("listChatMessages", () => {
  it("passes keyset cursor and after flag", async () => {
    rpcMock.mockResolvedValue({
      data: { items: [], has_more: false, next_cursor: null },
      error: null,
    });

    await listChatMessages({
      chatId: "chat-1",
      limit: 30,
      cursor: { created_at: "2026-01-01T00:00:00Z", id: "msg-1" },
      after: true,
    });

    expect(rpcMock).toHaveBeenCalledWith("list_chat_messages", {
      p_chat_id: "chat-1",
      p_limit: 30,
      p_cursor_created_at: "2026-01-01T00:00:00Z",
      p_cursor_id: "msg-1",
      p_after: true,
    });
  });
});

describe("closeConversation", () => {
  it("requires confirmation and idempotency key", async () => {
    const payload = {
      conversation: {
        id: "chat-1",
        service_request_id: "sr-1",
        client_id: "client-1",
        provider_id: "provider-1",
        status: "CLOSED",
        closure_type: "MANUAL",
        closure_reason: null,
        closed_at: "2026-06-01T12:00:00Z",
        closed_by_user_id: "client-1",
      },
    };
    rpcMock.mockResolvedValue({ data: payload, error: null });

    const result = await closeConversation({ chatId: "chat-1" });
    expect(result.data).toEqual(payload);
    expect(rpcMock).toHaveBeenCalledWith("cns_close_conversation", {
      p_chat_id: "chat-1",
      p_idempotency_key: "00000000-0000-7000-8000-000000000001",
      p_confirm: true,
      p_closure_reason: null,
    });
  });
});

describe("getConversationDetail", () => {
  it("returns detail snapshot", async () => {
    const payload = {
      conversation: { id: "chat-1" },
      counterparty: { id: "user-2" },
    };
    rpcMock.mockResolvedValue({ data: payload, error: null });

    const result = await getConversationDetail("chat-1");
    expect(result.data).toEqual(payload);
  });
});

describe("markConversationRead", () => {
  it("returns last_read_at", async () => {
    rpcMock.mockResolvedValue({
      data: { last_read_at: "2026-01-02T00:00:00Z" },
      error: null,
    });

    const result = await markConversationRead({
      chatId: "chat-1",
      lastReadMessageId: "msg-9",
    });
    expect(result.data?.last_read_at).toBe("2026-01-02T00:00:00Z");
  });
});

describe("sendMessage", () => {
  it("uses provided idempotency key", async () => {
    rpcMock.mockResolvedValue({
      data: {
        message: { id: "msg-1", chat_id: "chat-1" },
        conversation: { id: "chat-1" },
      },
      error: null,
    });

    await sendMessage({
      idempotencyKey: "custom-key",
      messageType: "TEXT",
      payload: { text: "Olá" },
      chatId: "chat-1",
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "cns_send_message",
      expect.objectContaining({ p_idempotency_key: "custom-key", p_message_type: "TEXT" }),
    );
  });

  it("maps rate limit with retry_after_seconds", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "RATE_LIMITED", details: '{"retry_after_seconds":42}' },
    });

    const result = await sendMessage({
      messageType: "TEXT",
      payload: { text: "x" },
      chatId: "chat-1",
    });

    expect(result.error?.code).toBe("RATE_LIMITED");
    expect(result.error?.retryAfterSeconds).toBe(42);
  });
});
