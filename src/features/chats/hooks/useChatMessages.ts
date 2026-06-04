import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth";
import { generateIdempotencyKeyV7 } from "@/lib/utils/idempotencyKey";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";
import { createMediaUploadSession, uploadChatMedia } from "../api/chatMedia.api";
import { listChatMessages, sendMessage } from "../api/chats.api";
import { Capacitor } from "@capacitor/core";
import { prepareChatImageFiles } from "../utils/chatImagePrepare";
import {
  normalizeChatImageFiles,
  validateChatImageFiles,
} from "../utils/chatImageValidation";
import { CHAT_CONVERSATIONS_LIST_QUERY_KEY, CHAT_MESSAGES_QUERY_KEY } from "../constants/queryKeys";
import { createClientSendId } from "../utils/clientSendId";
import { rememberSentChatMessageId } from "../utils/chatMessageSendSync";
import { lastConfirmedChatMessage } from "../utils/lastConfirmedChatMessage";
import { patchConversationDetailCache } from "../utils/patchConversationDetailCache";
import { patchConversationListCache } from "../utils/patchConversationListCache";
import { sendMessageResultToListItem } from "../utils/sendMessageToListItem";
import type {
  ChatMessageCursor,
  ChatMessageListItem,
  ChatsApiError,
  CnsMessageType,
} from "../types/chats.types";
import { mergeKeysetMessagePages } from "../utils/cursorMerge";
import {
  registerImagePreviewHoldover,
  clearImagePreviewHoldover,
} from "../utils/chatImagePreviewHoldover";
import {
  buildImageMessageSendPayload,
  getLocalPreviewUrlsFromPayload,
  stripClientOnlyImagePayloadFields,
} from "../utils/chatMessageImagePaths";

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

function sanitizeSendMessageInput(input: SendChatMessageInput): SendChatMessageInput {
  if (input.messageType !== "IMAGE") return input;

  return {
    ...input,
    payload: stripClientOnlyImagePayloadFields(input.payload),
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
  const localPreviewsByClientSendId = useRef<Map<string, string[]>>(new Map());
  const messagesRef = useRef<ChatMessageListItem[]>([]);
  const sendChainRef = useRef<Promise<void>>(Promise.resolve());
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessageListItem[]>([]);
  const [pendingSendCount, setPendingSendCount] = useState(0);
  const [lastSendError, setLastSendError] = useState<ChatsApiError | null>(null);

  const enabled = Boolean(chatId) && Boolean(user?.id) && (options?.enabled ?? true);

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
      if (!chatId || incoming.length === 0) return false;

      let merged = false;

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

          merged = true;

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

      return merged;
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
      if (input.messageType === "IMAGE") {
        const previewUrls = getLocalPreviewUrlsFromPayload(input.payload);
        registerImagePreviewHoldover(idempotencyKey, previewUrls);
      }
      setOptimisticMessages((prev) => [...prev, optimistic]);
      setLastSendError(null);

      patchConversationListCache(queryClient, {
        chatId,
        lastInteractionAt: optimistic.created_at,
        lastMessage: {
          id: optimistic.id,
          messageType: input.messageType,
          createdAt: optimistic.created_at,
          payload: input.payload,
        },
        markAsRead: true,
      });
    },
    [chatId, queryClient, user?.id],
  );

  const syncOptimisticPayload = useCallback((clientSendId: string, payloadPatch: Record<string, unknown>) => {
    const idempotencyKey = idempotencyByClientSendId.current.get(clientSendId);
    if (!idempotencyKey) return;

    const mergePayload = (payload: Record<string, unknown>) => ({ ...payload, ...payloadPatch });

    setOptimisticMessages((prev) =>
      prev.map((message) =>
        message.idempotency_key === idempotencyKey
          ? { ...message, payload: mergePayload(message.payload) }
          : message,
      ),
    );

  }, []);

  const setImagePendingSendInput = useCallback(
    (
      clientSendId: string,
      params: { uploadSessionId: string; paths: string[]; preview: string },
    ) => {
      pendingInputByClientSendId.current.set(clientSendId, {
        messageType: "IMAGE",
        clientSendId,
        payload: buildImageMessageSendPayload(params),
      });
    },
    [],
  );

  const detachLocalPreviewsForClientSendId = useCallback((clientSendId: string) => {
    localPreviewsByClientSendId.current.delete(clientSendId);
  }, []);

  const dismissOptimisticByClientSendId = useCallback(
    (clientSendId: string) => {
      const idempotencyKey = idempotencyByClientSendId.current.get(clientSendId);
      if (!idempotencyKey) return;
      setOptimisticMessages((prev) => prev.filter((m) => m.idempotency_key !== idempotencyKey));
      idempotencyByClientSendId.current.delete(clientSendId);
      pendingInputByClientSendId.current.delete(clientSendId);
      clearImagePreviewHoldover(idempotencyKey);
      detachLocalPreviewsForClientSendId(clientSendId);
    },
    [detachLocalPreviewsForClientSendId],
  );

  const resetOutboundSendState = useCallback(() => {
    for (const [, idempotencyKey] of idempotencyByClientSendId.current.entries()) {
      clearImagePreviewHoldover(idempotencyKey);
    }
    for (const urls of localPreviewsByClientSendId.current.values()) {
      for (const url of urls) {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      }
    }
    localPreviewsByClientSendId.current.clear();
    idempotencyByClientSendId.current.clear();
    pendingInputByClientSendId.current.clear();
    setOptimisticMessages([]);
    setLastSendError(null);
    sendChainRef.current = Promise.resolve();
    setPendingSendCount(0);
  }, []);

  useEffect(() => {
    resetOutboundSendState();
  }, [chatId, resetOutboundSendState]);

  const refetchLatestTailIntoCache = useCallback(async () => {
    if (!chatId) return;

    const result = await listChatMessages({
      chatId,
      limit: PAGE_SIZE,
      cursor: null,
      after: false,
    });

    if (result.error || !result.data) {
      logger.warn("chat_messages_tail_refresh_failed", {
        chatId,
        error: result.error?.code,
      });
      return;
    }

    mergeGapFillIntoCache(result.data.items);
  }, [chatId, mergeGapFillIntoCache]);

  const ensureMessagesCacheReady = useCallback(async () => {
    if (!chatId) return false;

    const current = queryClient.getQueryData<{
      pages: Array<{ items: ChatMessageListItem[] }>;
    }>([CHAT_MESSAGES_QUERY_KEY, chatId]);

    if (current?.pages?.length) return true;

    await queryClient.invalidateQueries({ queryKey: [CHAT_MESSAGES_QUERY_KEY, chatId] });
    return false;
  }, [chatId, queryClient]);

  const refetchGapFill = useCallback(async () => {
    const currentMessages = messagesRef.current;
    if (!chatId) return;

    const cacheReady = await ensureMessagesCacheReady();
    if (!cacheReady) return;

    let forwardCount = 0;
    const lastSeen = lastConfirmedChatMessage(currentMessages);

    if (lastSeen) {
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
      } else {
        forwardCount = result.data.items.length;
        if (forwardCount > 0) {
          mergeGapFillIntoCache(result.data.items);
        }
      }
    }

    // When our newest local row is newer than a counterparty message we have not
    // merged yet (near-simultaneous sends), forward-only gap fill returns nothing.
    if (forwardCount === 0) {
      await refetchLatestTailIntoCache();
    }
  }, [chatId, ensureMessagesCacheReady, mergeGapFillIntoCache, refetchLatestTailIntoCache]);

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
      const sanitizedInput = sanitizeSendMessageInput(input);
      const result = await sendMessage({
        chatId,
        messageType: sanitizedInput.messageType,
        payload: sanitizedInput.payload,
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
      detachLocalPreviewsForClientSendId(input.clientSendId);
      setLastSendError(null);

      rememberSentChatMessageId(result.message.id);
      mergeGapFillIntoCache([sendMessageResultToListItem(result.message)]);

      patchConversationDetailCache(queryClient, result.message.chat_id, {
        status: result.conversation.status,
        lastInteractionAt: result.conversation.last_interaction_at,
      });

      const patched = patchConversationListCache(queryClient, {
        chatId: result.message.chat_id,
        status: result.conversation.status,
        lastInteractionAt: result.conversation.last_interaction_at,
        lastMessage: {
          id: result.message.id,
          messageType: result.message.message_type,
          createdAt: result.message.created_at,
          payload: result.message.payload,
        },
        markAsRead: true,
      });

      if (!patched) {
        void queryClient.invalidateQueries({ queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY] });
      }
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
    (input: SendChatMessageInput, options?: { skipOptimistic?: boolean }) => {
      if (!chatId || !user?.id) {
        return Promise.reject(new Error("Autenticação necessária para enviar mensagem"));
      }

      if (!options?.skipOptimistic) {
        applyOptimisticSend(input);
      }
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

  const sendChatImages = useCallback(
    (files: File[], caption?: string) => {
      if (!chatId || !user?.id) {
        toast.error("Faça login para enviar imagens.");
        return;
      }

      const normalizedFiles = normalizeChatImageFiles(files);
      const validationError = validateChatImageFiles(normalizedFiles);
      if (validationError) {
        toast.error(validationError);
        return;
      }

      const clientSendId = createClientSendId();
      const localPreviewUrls = normalizedFiles.map((file) => URL.createObjectURL(file));
      localPreviewsByClientSendId.current.set(clientSendId, localPreviewUrls);
      const trimmedCaption = caption?.trim() ?? "";
      const preview =
        trimmedCaption ||
        (normalizedFiles.length === 1 ? "Foto" : `${normalizedFiles.length} fotos`);

      applyOptimisticSend({
        messageType: "IMAGE",
        payload: {
          local_preview_urls: localPreviewUrls,
          preview,
          paths: [],
        },
        clientSendId,
      });

      void (async () => {
        try {
          const preparedFiles = Capacitor.isNativePlatform()
            ? normalizedFiles
            : await prepareChatImageFiles(normalizedFiles);
          const preparedValidationError = validateChatImageFiles(preparedFiles);
          if (preparedValidationError) {
            toast.error(preparedValidationError);
            dismissOptimisticByClientSendId(clientSendId);
            return;
          }

          const sessionResult = await createMediaUploadSession(chatId);
          if (sessionResult.error || !sessionResult.data) {
            const message = sessionResult.error?.message ?? "Não foi possível preparar o envio.";
            toast.error(message);
            dismissOptimisticByClientSendId(clientSendId);
            return;
          }

          const uploadSessionId = sessionResult.data.upload_session_id;
          const idempotencyKey =
            idempotencyByClientSendId.current.get(clientSendId) ?? generateIdempotencyKeyV7();

          const uploadResult = await uploadChatMedia({
            chatId,
            uploadSessionId,
            files: preparedFiles,
            idempotencyKey,
          });
          if (uploadResult.error) {
            toast.error(uploadResult.error);
            dismissOptimisticByClientSendId(clientSendId);
            return;
          }

          syncOptimisticPayload(clientSendId, {
            upload_session_id: uploadSessionId,
            paths: uploadResult.paths,
            preview,
            local_preview_urls: localPreviewUrls,
          });

          const imageSendInput: SendChatMessageInput = {
            messageType: "IMAGE",
            clientSendId,
            payload: buildImageMessageSendPayload({
              uploadSessionId,
              paths: uploadResult.paths,
              preview,
            }),
          };
          setImagePendingSendInput(clientSendId, {
            uploadSessionId,
            paths: uploadResult.paths,
            preview,
          });

          await enqueueSend(imageSendInput, { skipOptimistic: true });
        } catch (error) {
          const apiError =
            error && typeof error === "object" && "code" in error
              ? (error as ChatsApiError)
              : null;
          if (apiError) {
            const message = apiError.message ?? "Não foi possível enviar a mensagem com a imagem.";
            toast.error(message);
            return;
          }

          logger.error("chat_image_send_failed", {
            chatId,
            error: error instanceof Error ? error.message : String(error),
          });
          dismissOptimisticByClientSendId(clientSendId);
          toast.error(
            error instanceof Error ? error.message : "Não foi possível enviar a imagem.",
          );
        }
      })();
    },
    [
      applyOptimisticSend,
      chatId,
      dismissOptimisticByClientSendId,
      enqueueSend,
      setImagePendingSendInput,
      syncOptimisticPayload,
      user?.id,
    ],
  );

  const retrySend = useCallback(
    (clientSendId: string) => {
      const pendingInput = pendingInputByClientSendId.current.get(clientSendId);
      if (!pendingInput || !chatId || !user?.id) return;

      setPendingSendCount((count) => count + 1);
      const sendPromise = sendChainRef.current.then(() =>
        sendMutation.mutateAsync(sanitizeSendMessageInput(pendingInput)),
      );
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

  const dismissFailedSend = useCallback(
    (idempotencyKey: string) => {
      setOptimisticMessages((prev) => prev.filter((m) => m.idempotency_key !== idempotencyKey));
      for (const [clientSendId, key] of idempotencyByClientSendId.current.entries()) {
        if (key === idempotencyKey) {
          idempotencyByClientSendId.current.delete(clientSendId);
          pendingInputByClientSendId.current.delete(clientSendId);
          clearImagePreviewHoldover(idempotencyKey);
          detachLocalPreviewsForClientSendId(clientSendId);
        }
      }
      setLastSendError(null);
    },
    [detachLocalPreviewsForClientSendId],
  );

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
    sendChatImages,
    retrySend,
    dismissFailedSend,
    isSending: pendingSendCount > 0,
    pendingSendCount,
    sendError: lastSendError,
    optimisticCount: optimisticMessages.length,
  };
}
