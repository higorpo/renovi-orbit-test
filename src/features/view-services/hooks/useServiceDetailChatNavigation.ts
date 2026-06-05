import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { generateIdempotencyKeyV7 } from "@/lib/utils/idempotencyKey";
import {
  CHAT_CONVERSATIONS_LIST_QUERY_KEY,
  initiateConversation,
  PROVIDER_SERVICE_CHAT_QUERY_KEY,
} from "@/features/chats";
import type { ChatsApiError } from "@/features/chats";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const OFFLINE_MESSAGE =
  "Você está offline. Conecte-se à internet para abrir a conversa.";

function resolveMutationError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message === "OFFLINE") {
    return OFFLINE_MESSAGE;
  }

  const apiError = error as ChatsApiError;
  return apiError?.message ?? fallback;
}

interface UseServiceDetailChatNavigationParams {
  serviceRequestId: string;
  existingChatId: string | null | undefined;
}

export function useServiceDetailChatNavigation({
  serviceRequestId,
  existingChatId,
}: UseServiceDetailChatNavigationParams) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const initiateIdempotencyKeyRef = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isOnline) {
        throw new Error("OFFLINE");
      }

      if (existingChatId) {
        return { id: existingChatId };
      }

      const idempotencyKey =
        initiateIdempotencyKeyRef.current ?? generateIdempotencyKeyV7();
      initiateIdempotencyKeyRef.current = idempotencyKey;

      const result = await initiateConversation({ serviceRequestId, idempotencyKey });
      if (result.error || !result.data) {
        throw result.error ?? new Error("Não foi possível iniciar a conversa.");
      }

      return result.data.conversation;
    },
    onSuccess: (conversation) => {
      initiateIdempotencyKeyRef.current = null;
      void queryClient.invalidateQueries({ queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY] });
      void queryClient.invalidateQueries({
        queryKey: [PROVIDER_SERVICE_CHAT_QUERY_KEY, serviceRequestId],
      });
      void navigate(`/dashboard/chats/${conversation.id}`);
    },
    onError: (error) => {
      const fallback = existingChatId
        ? "Não foi possível abrir a conversa."
        : "Não foi possível iniciar a conversa.";
      toast.error(resolveMutationError(error, fallback));
    },
  });

  const openChat = useCallback(() => {
    mutation.mutate();
  }, [mutation]);

  return {
    openChat,
    isOpeningChat: mutation.isPending,
  };
}
