import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { CHAT_CONVERSATIONS_LIST_QUERY_KEY } from "../constants/queryKeys";
import type {
  ConversationListItem,
  ConversationListResponse,
  CnsMessageType,
} from "../types/chats.types";

export interface ConversationListMessagePatch {
  id: string;
  messageType: CnsMessageType;
  createdAt: string;
  payload: Record<string, unknown>;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
}

export interface PatchConversationListCacheParams {
  chatId: string;
  lastInteractionAt: string;
  lastMessage: ConversationListMessagePatch;
  markAsRead?: boolean;
  markAsUnread?: boolean;
}

/** Mirrors public.cns_message_preview_text used by list_conversations. */
function buildInboxMessagePreviewText(
  messageType: CnsMessageType,
  payload: Record<string, unknown>,
): string {
  switch (messageType) {
    case "IMAGE":
      return "📷 Foto";
    case "PROPOSAL":
      return "📋 Proposta";
    case "SYSTEM": {
      const text = payload.text;
      if (typeof text === "string" && text.trim()) return text.trim();
      return "Mensagem do sistema";
    }
    case "WORKFLOW_ACTION": {
      const text = payload.text;
      if (typeof text === "string" && text.trim()) return text.trim();
      return "Atualização";
    }
    default: {
      const text = payload.text;
      const normalized =
        typeof text === "string" && text.trim() ? text.trim() : "Nova mensagem";
      return normalized.length > 120 ? normalized.slice(0, 120) : normalized;
    }
  }
}

function applyPatchToItem(
  item: ConversationListItem,
  params: PatchConversationListCacheParams,
): ConversationListItem {
  const { lastMessage, lastInteractionAt, markAsRead, markAsUnread } = params;

  return {
    ...item,
    last_interaction_at: lastInteractionAt,
    updated_at: lastInteractionAt,
    last_message: {
      id: lastMessage.id,
      message_type: lastMessage.messageType,
      created_at: lastMessage.createdAt,
      preview_text: buildInboxMessagePreviewText(lastMessage.messageType, lastMessage.payload),
      linked_entity_type: lastMessage.linkedEntityType ?? null,
      linked_entity_id: lastMessage.linkedEntityId ?? null,
    },
    is_unread: markAsRead ? false : markAsUnread ? true : item.is_unread,
    last_read_at: markAsRead ? lastMessage.createdAt : item.last_read_at,
  };
}

function rebuildInfinitePages(
  pages: ConversationListResponse[],
  reorderedItems: ConversationListItem[],
): ConversationListResponse[] {
  let offset = 0;

  return pages.map((page) => {
    const items = reorderedItems.slice(offset, offset + page.items.length);
    offset += page.items.length;
    return { ...page, items };
  });
}

export function patchConversationListCache(
  queryClient: QueryClient,
  params: PatchConversationListCacheParams,
): boolean {
  let patched = false;

  queryClient.setQueriesData<InfiniteData<ConversationListResponse>>(
    { queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY] },
    (current) => {
      if (!current?.pages?.length) return current;

      const flatItems = current.pages.flatMap((page) => page.items);
      const existing = flatItems.find((item) => item.id === params.chatId);
      if (!existing) return current;

      const updatedItem = applyPatchToItem(existing, params);
      const reordered = [
        updatedItem,
        ...flatItems.filter((item) => item.id !== params.chatId),
      ];

      patched = true;

      return {
        ...current,
        pages: rebuildInfinitePages(current.pages, reordered),
      };
    },
  );

  return patched;
}

/** Clears unread state without reordering the list or changing preview/timestamps. */
export function clearConversationUnreadInListCache(
  queryClient: QueryClient,
  params: { chatId: string; lastReadAt: string },
): boolean {
  let patched = false;

  queryClient.setQueriesData<InfiniteData<ConversationListResponse>>(
    { queryKey: [CHAT_CONVERSATIONS_LIST_QUERY_KEY] },
    (current) => {
      if (!current?.pages?.length) return current;

      let found = false;
      const pages = current.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => {
          if (item.id !== params.chatId) return item;
          found = true;
          if (!item.is_unread && item.last_read_at === params.lastReadAt) return item;
          patched = true;
          return {
            ...item,
            is_unread: false,
            last_read_at: params.lastReadAt,
          };
        }),
      }));

      if (!found) return current;
      return { ...current, pages };
    },
  );

  return patched;
}
