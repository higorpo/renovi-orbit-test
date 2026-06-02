import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { CnsMessageType } from "../types/chats.types";

export type InboxMessageInsertPayload = {
  id: string;
  chatId: string;
  senderUserId: string;
  messageType: CnsMessageType;
  createdAt: string;
  payload: Record<string, unknown>;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
};

export type InboxRealtimeHandlers = {
  onMessageInsert: (payload: InboxMessageInsertPayload) => void;
  onStatusChange: (status: string) => void;
};

export function inboxChannelName(userId: string): string {
  return `inbox:${userId}`;
}

function parseMessageInsertPayload(payload: unknown): InboxMessageInsertPayload | null {
  const row = (payload as { new?: Record<string, unknown> } | null)?.new;
  if (!row) return null;

  const id = row.id;
  const chatId = row.chat_id;
  const senderUserId = row.sender_user_id;
  const messageType = row.message_type;
  const createdAt = row.created_at;
  const messagePayload = row.payload;

  if (
    typeof id !== "string" ||
    typeof chatId !== "string" ||
    typeof senderUserId !== "string" ||
    typeof messageType !== "string" ||
    typeof createdAt !== "string" ||
    !messagePayload ||
    typeof messagePayload !== "object"
  ) {
    return null;
  }

  return {
    id,
    chatId,
    senderUserId,
    messageType: messageType as CnsMessageType,
    createdAt,
    payload: messagePayload as Record<string, unknown>,
    linkedEntityType: typeof row.linked_entity_type === "string" ? row.linked_entity_type : null,
    linkedEntityId: typeof row.linked_entity_id === "string" ? row.linked_entity_id : null,
  };
}

export function subscribeInboxChannel(
  client: SupabaseClient<Database>,
  userId: string,
  handlers: InboxRealtimeHandlers,
): RealtimeChannel {
  const channel = client.channel(inboxChannelName(userId));

  channel
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
      },
      (payload) => {
        const parsed = parseMessageInsertPayload(payload);
        if (parsed) handlers.onMessageInsert(parsed);
      },
    )
    .subscribe((status) => {
      handlers.onStatusChange(status);
    });

  return channel;
}
