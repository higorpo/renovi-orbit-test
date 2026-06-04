import { generateIdempotencyKeyV7 } from "@/lib/utils/idempotencyKey";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import { supabase } from "@/lib/supabase/client";
import type {
  ChatMessageListResponse,
  ChatsApiResult,
  ConversationDetailResponse,
  ConversationListResponse,
  CnsMessageType,
  CloseConversationResult,
  InitiateConversationResult,
  MarkConversationReadResult,
  SendMessageResult,
} from "../types/chats.types";
import { mapCnsRpcError } from "../utils/chatApiErrors";
import { CNS_CHAT_RPC } from "./chats.rpc";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; details?: string } | null }>;
};

function getRpcClient(): RpcClient {
  return supabase as unknown as RpcClient;
}

function trackApiError(rpc: string, code: string): void {
  logger.error("chats_api_error", { rpc, code });
  metrics.count("chats.api_error", 1, { rpc, code });
}

async function invokeRpc<T>(
  rpc: string,
  args: Record<string, unknown>,
  validate: (data: unknown) => data is T,
  invalidLogKey: string,
): Promise<ChatsApiResult<T>> {
  const client = getRpcClient();
  const { data, error } = await client.rpc(rpc, args);

  if (error) {
    const mapped = mapCnsRpcError(error);
    trackApiError(rpc, mapped.code);
    return { data: null, error: mapped };
  }

  if (!validate(data)) {
    logger.error(invalidLogKey, { rpc, data });
    trackApiError(rpc, "INVALID_RESPONSE");
    return {
      data: null,
      error: {
        code: "UNKNOWN",
        message: "Resposta inesperada do servidor.",
      },
    };
  }

  return { data, error: null };
}

function isConversationListResponse(value: unknown): value is ConversationListResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.items) && typeof v.has_more === "boolean";
}

function isChatMessageListResponse(value: unknown): value is ChatMessageListResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.items) && typeof v.has_more === "boolean";
}

function isConversationDetailResponse(value: unknown): value is ConversationDetailResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.conversation != null &&
    typeof v.conversation === "object" &&
    v.counterparty != null &&
    typeof v.counterparty === "object"
  );
}

function isSendMessageResult(value: unknown): value is SendMessageResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.message != null && typeof v.message === "object" && v.conversation != null;
}

function isInitiateConversationResult(value: unknown): value is InitiateConversationResult {
  if (!value || typeof value !== "object") return false;
  const conversation = (value as InitiateConversationResult).conversation;
  return (
    conversation != null &&
    typeof conversation === "object" &&
    typeof conversation.id === "string" &&
    typeof conversation.service_request_id === "string"
  );
}

function isMarkConversationReadResult(value: unknown): value is MarkConversationReadResult {
  if (!value || typeof value !== "object") return false;
  return typeof (value as MarkConversationReadResult).last_read_at === "string";
}

function isCloseConversationResult(value: unknown): value is CloseConversationResult {
  if (!value || typeof value !== "object") return false;
  const conversation = (value as CloseConversationResult).conversation;
  return conversation != null && typeof conversation.id === "string";
}

export async function listConversations(params: {
  pageSize?: number;
  cursor?: { last_interaction_at: string; id: string } | null;
}): Promise<ChatsApiResult<ConversationListResponse>> {
  return invokeRpc(
    CNS_CHAT_RPC.listConversations,
    {
      p_page_size: params.pageSize ?? 20,
      p_cursor_last_interaction_at: params.cursor?.last_interaction_at ?? null,
      p_cursor_id: params.cursor?.id ?? null,
    },
    isConversationListResponse,
    "chats_list_conversations_invalid_response",
  );
}

export async function listChatMessages(params: {
  chatId: string;
  limit?: number;
  cursor?: { created_at: string; id: string } | null;
  after?: boolean;
}): Promise<ChatsApiResult<ChatMessageListResponse>> {
  return invokeRpc(
    CNS_CHAT_RPC.listChatMessages,
    {
      p_chat_id: params.chatId,
      p_limit: params.limit ?? 20,
      p_cursor_created_at: params.cursor?.created_at ?? null,
      p_cursor_id: params.cursor?.id ?? null,
      p_after: params.after ?? false,
    },
    isChatMessageListResponse,
    "chats_list_messages_invalid_response",
  );
}

export async function getConversationDetail(
  chatId: string,
): Promise<ChatsApiResult<ConversationDetailResponse>> {
  return invokeRpc(
    CNS_CHAT_RPC.getConversationDetail,
    { p_chat_id: chatId },
    isConversationDetailResponse,
    "chats_get_conversation_detail_invalid_response",
  );
}

export async function closeConversation(params: {
  chatId: string;
  idempotencyKey?: string;
  closureReason?: string | null;
}): Promise<ChatsApiResult<CloseConversationResult>> {
  return invokeRpc(
    CNS_CHAT_RPC.closeConversation,
    {
      p_chat_id: params.chatId,
      p_idempotency_key: params.idempotencyKey ?? generateIdempotencyKeyV7(),
      p_confirm: true,
      p_closure_reason: params.closureReason ?? null,
    },
    isCloseConversationResult,
    "chats_close_conversation_invalid_response",
  );
}

export async function markConversationRead(params: {
  chatId: string;
  lastReadMessageId?: string | null;
}): Promise<ChatsApiResult<MarkConversationReadResult>> {
  return invokeRpc(
    CNS_CHAT_RPC.markConversationRead,
    {
      p_chat_id: params.chatId,
      p_last_read_message_id: params.lastReadMessageId ?? null,
    },
    isMarkConversationReadResult,
    "chats_mark_conversation_read_invalid_response",
  );
}

export async function checkChatFreeMessagingAllowed(
  chatId: string,
): Promise<ChatsApiResult<boolean>> {
  const client = getRpcClient();
  const { data, error } = await client.rpc(CNS_CHAT_RPC.chatFreeMessagingAllowed, {
    p_chat_id: chatId,
  });

  if (error) {
    const mapped = mapCnsRpcError(error);
    trackApiError(CNS_CHAT_RPC.chatFreeMessagingAllowed, mapped.code);
    return { data: null, error: mapped };
  }

  if (typeof data !== "boolean") {
    logger.error("chats_free_messaging_invalid_response", { chatId, data });
    trackApiError(CNS_CHAT_RPC.chatFreeMessagingAllowed, "INVALID_RESPONSE");
    return {
      data: null,
      error: { code: "UNKNOWN", message: "Resposta inesperada do servidor." },
    };
  }

  return { data, error: null };
}

export async function initiateConversation(params: {
  serviceRequestId: string;
  idempotencyKey?: string;
}): Promise<ChatsApiResult<InitiateConversationResult>> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  return invokeRpc(
    CNS_CHAT_RPC.initiateConversation,
    {
      p_service_request_id: params.serviceRequestId,
      p_idempotency_key: idempotencyKey,
    },
    isInitiateConversationResult,
    "chats_initiate_conversation_invalid_response",
  );
}

export async function sendMessage(params: {
  idempotencyKey?: string;
  messageType: CnsMessageType;
  payload: Record<string, unknown>;
  chatId?: string;
  serviceRequestId?: string;
}): Promise<ChatsApiResult<SendMessageResult>> {
  const idempotencyKey = params.idempotencyKey ?? generateIdempotencyKeyV7();

  return invokeRpc(
    CNS_CHAT_RPC.sendMessage,
    {
      p_idempotency_key: idempotencyKey,
      p_message_type: params.messageType,
      p_payload: params.payload,
      p_chat_id: params.chatId ?? null,
      p_service_request_id: params.serviceRequestId ?? null,
    },
    isSendMessageResult,
    "chats_send_message_invalid_response",
  );
}

export const chatsApi = {
  listConversations,
  listChatMessages,
  getConversationDetail,
  closeConversation,
  markConversationRead,
  checkChatFreeMessagingAllowed,
  initiateConversation,
  sendMessage,
};
