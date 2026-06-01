import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/features/auth";
import { generateIdempotencyKeyV7 } from "@/features/notifications";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import { listChatMessages, sendMessage } from "../api/chats.api";
import { CHAT_CONVERSATIONS_LIST_QUERY_KEY, CHAT_MESSAGES_QUERY_KEY } from "../constants/queryKeys";
import { rememberSentChatMessageId } from "../utils/chatMessageSendSync";
import { sendMessageResultToListItem } from "../utils/sendMessageToListItem";
import type {
  ChatMessageCursor,
  ChatMessageListItem,
  ChatsApiError,
  CnsMessageType,
} from "../types/chats.types";
import { mergeKeysetMessagePages } from "../utils/cursorMerge";

const PAGE_SIZE = 20;
const STALE_TIME_MS = 30_000;

export interface SendChatMessageInput {
  messageType: CnsMessageType;
  payload: Record<string, unknown>;
  /** Stable client id for optimistic row + idempotency retry (R3-AC07). */
  clientSendId: string;
}

function buildOptimisticMessage(
  chatId: string,
  senderUserId: string,
  input: SendChatMessageInput,
  idempotencyKey: string,
): ChatMessageListItem {
  const now = new Date().toISOString();
  return {
    id: `optimistic:${idempotencyKey}`,
    chat_id: chatId,
    sender_user_id: senderUserId,
    message_type: input.messageType,
    payload: input.payload,
    linked_entity_type: null,
    linked_entity_id: null,
    idempotency_key: idempotencyKey,
    delivery_status: "PENDING",
    created_at: now,
    updated_at: now,
  };
}

export function useChatMessages(
  chatId: string | null,
  options?: { enabled?: boolean },
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const idempotencyByClientSendId = useRef<Map<string, string>>(new Map());
  const pendingInputByClientSendId = useRef<Map<string, SendChatMessageInput>>(new Map());
  const messagesRef = useRef<ChatMessageListItem[]>([]);
  const sendChainRef = useRef<Promise<void>>(Promise.resolve());
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessageListItem[]>([]);
  const [pendingSendCount, setPendingSendCount] = useState(0);
  const [lastSendError, setLastSendError] = useState<ChatsApiError | null>(null);

  const enabled = Boolean(chatId) && Boolean(user?.id) && (options?.enabled ?? true);

  useEffect(() => {
    sendChainRef.current = Promise.resolve();
    setPendingSendCount(0);
  }, [chatId]);

  const query = useInfiniteQuery({
    queryKey: [CHAT_MESSAGES_QUERY_KEY, chatId],
    queryFn: async ({ pageParam }) => {
      const result = await listChatMessages({
        chatId: chatId!,
        limit: PAGE_SIZE,
        cursor: pageParam,
      });
      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "Erro ao carregar mensagens");
      }
      return result.data;
    },
    initialPageParam: null as ChatMessageCursor | null,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor : undefined),
    enabled,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const serverMessages = useMemo(() => {
    const pages = query.data?.pages ?? [];
    return mergeKeysetMessagePages<ChatMessageListItem>(
      [],
      pages.flatMap((page) => page.items),
    );
  }, [query.data]);

  const messages = useMemo(
    () => mergeKeysetMessagePages(serverMessages, optimisticMessages),
    [serverMessages, optimisticMessages],
  );
  messagesRef.current = messages;

  const mergeGapFillIntoCache = useCallback(
    (incoming: ChatMessageListItem[]) => {
      if (!chatId || incoming.length === 0) return;

      queryClient.setQueryData(
        [CHAT_MESSAGES_QUERY_KEY, chatId],
        (
          current:
            | {
                pages: Array<{ items: ChatMessageListItem[]; has_more: boolean; next_cursor: ChatMessageCursor | null }>;
                pageParams: unknown[];
              }
            | undefined,
        ) => {
          if (!current?.pages?.length) return current;

          const mergedItems = mergeKeysetMessagePages(
            current.pages[0]?.items ?? [],
            incoming,
          );

          return {
            ...current,
            pages: [
              {
                ...current.pages[0]!,
                items: mergedItems,
              },
              ...current.pages.slice(1),
            ],
          };
        },
      );
    },
    [chatId, queryClient],
  );

  const applyOptimisticSend = useCallback(
    (input: SendChatMessageInput) => {
      if (!chatId || !user?.id) return;

      const idempotencyKey =
        idempotencyByClientSendId.current.get(input.clientSendId) ??
        generateIdempotencyKeyV7();
      idempotencyByClientSendId.current.set(input.clientSendId, idempotencyKey);
      pendingInputByClientSendId.current.set(input.clientSendId, input);

      const optimistic = buildOptimisticMessage(chatId, user.id, input, idempotencyKey);
      setOptimisticMessages((prev) => [...prev, optimistic]);
      setLastSendError(null);
    },
    [chatId, user?.id],
  );

  const refetchGapFill = useCallback(async () => {
    const currentMessages = messagesRef.current;
    if (!chatId || currentMessages.length === 0) return;

    const lastSeen = currentMessages[currentMessages.length - 1]!;
    const result = await listChatMessages({
      chatId,
      limit: PAGE_SIZE,
      cursor: { created_at: lastSeen.created_at, id: lastSeen.id },
      after: true,
    });

    if (result.error || !result.data) {
      logger.warn("chat_messages_gap_fill_failed", {
        chatId,
        error: result.error?.code,
      });
      return;
    }

    mergeGapFillIntoCache(result.data.items);
  }, [chatId, mergeGapFillIntoCache]);

  const sendMutation = useMutation({
    mutationFn: async (input: SendChatMessageInput) => {
      if (!chatId || !user?.id) {
        throw new Error("Autenticação necessária para enviar mensagem");
      }

      const idempotencyKey =
        idempotencyByClientSendId.current.get(input.clientSendId) ??
        generateIdempotencyKeyV7();
      idempotencyByClientSendId.current.set(input.clientSendId, idempotencyKey);

      const startedAt = performance.now();
      const result = await sendMessage({
        chatId,
        messageType: input.messageType,
        payload: input.payload,
        idempotencyKey,
      });
      const durationMs = Math.round(performance.now() - startedAt);

      if (result.error || !result.data) {
        metrics.count("chats.send_message_failed", 1, {
          code: result.error?.code ?? "UNKNOWN",
        });
        throw result.error ?? new Error("Erro ao enviar mensagem");
      }

      metrics.distribution("chats.send_message_duration_ms", durationMs, {
        message_type: input.messageType,
      });
      logger.info("chat_message_sent", {
        chatId,
        messageId: result.data.message.id,
        durationMs,
      });

      return { result: result.data, idempotencyKey, input };
    },
    onSuccess: ({ result, idempotencyKey, input }) => {
      setOptimisticMessages((prev) =>
        prev.filter((message) => message.idempotency_key !== idempotencyKey),
      );
      idempotencyByClientSendId.current.delete(input.clientSendId);
      pendingInputByClientSendId.current.delete(input.clientSendId);
      setLastSendError(null);

      rememberSentChatMessageId(result.message.id);
      mergeGapFillIntoCache([sendMessageResultToListItem(result.message)]);
      void queryClient.invalidateQueries({ queryKey: [CHAT_MESSAGES_QUERY_KEY, chatId] });
      void queryClient.invalidateQueries({ queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY] });
    },
    onError: (error, input) => {
      const apiError =
        error && typeof error === "object" && "code" in error
          ? (error as ChatsApiError)
          : {
              code: "UNKNOWN" as const,
              message: error instanceof Error ? error.message : "Erro ao enviar mensagem",
            };
      setLastSendError(apiError);
      logger.warn("chat_message_send_failed", {
        chatId,
        clientSendId: input.clientSendId,
        code: apiError.code,
      });
    },
  });

  const enqueueSend = useCallback(
    (input: SendChatMessageInput) => {
      if (!chatId || !user?.id) {
        return Promise.reject(new Error("Autenticação necessária para enviar mensagem"));
      }

      applyOptimisticSend(input);
      setPendingSendCount((count) => count + 1);

      const sendPromise = sendChainRef.current.then(() => sendMutation.mutateAsync(input));
      sendChainRef.current = sendPromise.then(
        () => undefined,
        () => undefined,
      );

      return sendPromise.finally(() => {
        setPendingSendCount((count) => Math.max(0, count - 1));
      });
    },
    [applyOptimisticSend, chatId, sendMutation, user?.id],
  );

  const sendChatMessage = useCallback(
    (input: SendChatMessageInput) => enqueueSend(input),
    [enqueueSend],
  );

  const retrySend = useCallback(
    (clientSendId: string) => {
      const pendingInput = pendingInputByClientSendId.current.get(clientSendId);
      if (!pendingInput || !chatId || !user?.id) return;

      setPendingSendCount((count) => count + 1);
      const sendPromise = sendChainRef.current.then(() => sendMutation.mutateAsync(pendingInput));
      sendChainRef.current = sendPromise.then(
        () => undefined,
        () => undefined,
      );

      return sendPromise.finally(() => {
        setPendingSendCount((count) => Math.max(0, count - 1));
      });
    },
    [chatId, sendMutation, user?.id],
  );

  const dismissFailedSend = useCallback((idempotencyKey: string) => {
    setOptimisticMessages((prev) => prev.filter((m) => m.idempotency_key !== idempotencyKey));
    for (const [clientSendId, key] of idempotencyByClientSendId.current.entries()) {
      if (key === idempotencyKey) {
        idempotencyByClientSendId.current.delete(clientSendId);
        pendingInputByClientSendId.current.delete(clientSendId);
      }
    }
    setLastSendError(null);
  }, []);

  return {
    messages,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage ?? false,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    refetchGapFill,
    sendChatMessage,
    retrySend,
    dismissFailedSend,
    isSending: pendingSendCount > 0,
    pendingSendCount,
    sendError: lastSendError,
    optimisticCount: optimisticMessages.length,
  };
}
