import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { closeConversation } from "../api/chats.api";
import {
  CHAT_CONVERSATIONS_LIST_QUERY_KEY,
  CHAT_FREE_MESSAGING_QUERY_KEY,
  CHAT_MESSAGES_QUERY_KEY,
  CONVERSATION_DETAIL_QUERY_KEY,
} from "../constants/queryKeys";
import type { ChatsApiError } from "../types/chats.types";
import { useChatAnalytics } from "./useChatAnalytics";

const OFFLINE_MESSAGE =
  "Você está offline. Conecte-se à internet para encerrar a conversa.";

function invalidateChatQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  chatId: string,
) {
  void queryClient.invalidateQueries({ queryKey: [CHAT_MESSAGES_QUERY_KEY, chatId] });
  void queryClient.invalidateQueries({ queryKey: [CONVERSATION_DETAIL_QUERY_KEY, chatId] });
  void queryClient.invalidateQueries({ queryKey: [CHAT_FREE_MESSAGING_QUERY_KEY, chatId] });
  void queryClient.invalidateQueries({ queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY] });
}

function resolveMutationError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message === "OFFLINE") {
    return OFFLINE_MESSAGE;
  }

  const apiError = error as ChatsApiError;
  return apiError?.message ?? fallback;
}

export function useCloseConversationMutation(chatId: string | null) {
  const queryClient = useQueryClient();
  const analytics = useChatAnalytics();
  const isOnline = useOnlineStatus();

  return useMutation({
    mutationFn: async () => {
      if (!chatId) {
        throw new Error("Conversa não encontrada.");
      }

      if (!isOnline) {
        throw new Error("OFFLINE");
      }

      const result = await closeConversation({ chatId });
      if (result.error || !result.data) {
        throw result.error ?? new Error("Não foi possível encerrar a conversa.");
      }

      return result.data;
    },
    onSuccess: (data) => {
      if (!chatId) return;

      analytics.conversation_closed({
        chat_id: chatId,
        service_request_id: data.conversation.service_request_id,
        closure_type: data.conversation.closure_type ?? "MANUAL",
      });
      invalidateChatQueries(queryClient, chatId);
      toast.success("Conversa encerrada.");
    },
    onError: (error) => {
      toast.error(resolveMutationError(error, "Não foi possível encerrar a conversa."));
    },
  });
}
