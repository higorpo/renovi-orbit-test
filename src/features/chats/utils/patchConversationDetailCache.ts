import type { QueryClient } from "@tanstack/react-query";
import { CONVERSATION_DETAIL_QUERY_KEY } from "../constants/queryKeys";
import type { ConversationDetailResponse, CnsConversationStatus } from "../types/chats.types";

export interface PatchConversationDetailCacheParams {
  status?: CnsConversationStatus;
  lastInteractionAt?: string;
}

export function patchConversationDetailCache(
  queryClient: QueryClient,
  chatId: string,
  params: PatchConversationDetailCacheParams,
): boolean {
  let patched = false;

  queryClient.setQueryData<ConversationDetailResponse>(
    [CONVERSATION_DETAIL_QUERY_KEY, chatId],
    (current) => {
      if (!current) return current;

      patched = true;
      const conversation = { ...current.conversation };

      if (params.status !== undefined) {
        conversation.status = params.status;
        if (params.status === "ACTIVE") {
          conversation.inactivated_at = null;
          conversation.inactivation_reason = null;
        }
      }

      if (params.lastInteractionAt !== undefined) {
        conversation.last_interaction_at = params.lastInteractionAt;
        conversation.updated_at = params.lastInteractionAt;
      }

      return { ...current, conversation };
    },
  );

  return patched;
}
