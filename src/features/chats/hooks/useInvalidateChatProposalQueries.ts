import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "@/features/auth";
import type { CreateProviderProposalResult } from "@/features/negotiation-proposals";
import {
  CHAT_FREE_MESSAGING_QUERY_KEY,
  CHAT_MESSAGES_QUERY_KEY,
  CHAT_PROPOSAL_TIMELINE_QUERY_KEY,
} from "../constants/queryKeys";
import type { ChatMessageListItem } from "../types/chats.types";
import { mergeKeysetMessagePages } from "../utils/cursorMerge";
import { proposalTimelineMessageToListItem } from "../utils/proposalTimelineMessageToListItem";

function mergeTimelineMessageIntoMessagesCache(
  queryClient: ReturnType<typeof useQueryClient>,
  chatId: string,
  timelineMessage: NonNullable<CreateProviderProposalResult["timeline_message"]>,
  senderUserId: string,
  proposalVersion: number,
): void {
  const listItem = proposalTimelineMessageToListItem(
    timelineMessage,
    senderUserId,
    proposalVersion,
  );

  queryClient.setQueryData(
    [CHAT_MESSAGES_QUERY_KEY, chatId],
    (
      current:
        | {
            pages: Array<{
              items: ChatMessageListItem[];
              has_more: boolean;
              next_cursor: unknown;
            }>;
            pageParams: unknown[];
          }
        | undefined,
    ) => {
      if (!current?.pages?.length) return current;

      const mergedItems = mergeKeysetMessagePages(
        current.pages[0]?.items ?? [],
        [listItem],
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
}

export function useInvalidateChatProposalQueries(chatId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useCallback(
    (submitResult?: CreateProviderProposalResult) => {
      if (!chatId) return;

      const timelineMessage = submitResult?.timeline_message;
      if (timelineMessage && user?.id) {
        mergeTimelineMessageIntoMessagesCache(
          queryClient,
          chatId,
          timelineMessage,
          user.id,
          submitResult.proposal.version,
        );
      }

      void queryClient.invalidateQueries({ queryKey: [CHAT_MESSAGES_QUERY_KEY, chatId] });
      void queryClient.invalidateQueries({ queryKey: [CHAT_PROPOSAL_TIMELINE_QUERY_KEY, chatId] });
      void queryClient.invalidateQueries({ queryKey: [CHAT_FREE_MESSAGING_QUERY_KEY, chatId] });
    },
    [chatId, queryClient, user?.id],
  );
}
