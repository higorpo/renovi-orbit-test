import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  CHAT_CONVERSATIONS_LIST_QUERY_KEY,
  initiateConversation,
} from "@/features/chats";
import type { ChatsApiError } from "@/features/chats";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const OFFLINE_MESSAGE =
  "Você está offline. Conecte-se à internet para iniciar a conversa.";

function resolveMutationError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message === "OFFLINE") {
    return OFFLINE_MESSAGE;
  }

  const apiError = error as ChatsApiError;
  return apiError?.message ?? fallback;
}

export function useProviderJobChatNavigation(serviceRequestId: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isOnline) {
        throw new Error("OFFLINE");
      }

      const result = await initiateConversation({ serviceRequestId });
      if (result.error || !result.data) {
        throw result.error ?? new Error("Não foi possível iniciar a conversa.");
      }

      return result.data.conversation;
    },
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({ queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY] });
      void navigate(`/dashboard/chats/${conversation.id}`);
    },
    onError: (error) => {
      toast.error(resolveMutationError(error, "Não foi possível iniciar a conversa."));
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
