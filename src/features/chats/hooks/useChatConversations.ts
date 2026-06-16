import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { listConversations } from "../api/chats.api";
import { CHAT_CONVERSATIONS_LIST_QUERY_KEY } from "../constants/queryKeys";
import type { ConversationListCursor, ConversationListItem } from "../types/chats.types";

const PAGE_SIZE = 20;
const STALE_TIME_MS = 30_000;

export function useChatConversations(options?: {
  enabled?: boolean;
  pageSize?: number;
  serviceRequestId?: string | null;
}) {
  const pageSize = options?.pageSize ?? PAGE_SIZE;
  const serviceRequestId = options?.serviceRequestId ?? null;

  const query = useInfiniteQuery({
    queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY, pageSize, serviceRequestId],
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as ConversationListCursor | null;
      const result = await listConversations({
        pageSize,
        cursor,
        serviceRequestId,
      });

      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? "Erro ao carregar conversas");
      }

      return result.data;
    },
    initialPageParam: null as ConversationListCursor | null,
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.next_cursor : undefined),
    enabled: options?.enabled ?? true,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const conversations = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  return {
    conversations,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage ?? false,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}

export type { ConversationListItem };
