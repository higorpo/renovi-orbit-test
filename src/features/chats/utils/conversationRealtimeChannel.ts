import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type ConversationRealtimeHandlers = {
  onMessageInsert: (payload: { id: string }) => void;
  onProposalUpdate: (payload: { id: string }) => void;
  onReadReceiptChange: (payload: {
    userId: string;
    lastReadMessageId: string | null;
    lastReadAt: string;
  }) => void;
  onStatusChange: (status: string) => void;
};

export function conversationChannelName(chatId: string): string {
  return `conversation:${chatId}`;
}

export function subscribeConversationChannel(
  client: SupabaseClient<Database>,
  chatId: string,
  handlers: ConversationRealtimeHandlers,
): RealtimeChannel {
  const channel = client.channel(conversationChannelName(chatId));

  channel
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        const id = (payload.new as { id?: string } | null)?.id;
        if (id) handlers.onMessageInsert({ id });
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "provider_proposals",
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        const id = (payload.new as { id?: string } | null)?.id;
        if (id) handlers.onProposalUpdate({ id });
      },
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_read_receipts",
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        const row = payload.new as {
          user_id?: string;
          last_read_message_id?: string | null;
          last_read_at?: string;
        } | null;
        if (row?.user_id && row.last_read_at) {
          handlers.onReadReceiptChange({
            userId: row.user_id,
            lastReadMessageId: row.last_read_message_id ?? null,
            lastReadAt: row.last_read_at,
          });
        }
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "chat_read_receipts",
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        const row = payload.new as {
          user_id?: string;
          last_read_message_id?: string | null;
          last_read_at?: string;
        } | null;
        if (row?.user_id && row.last_read_at) {
          handlers.onReadReceiptChange({
            userId: row.user_id,
            lastReadMessageId: row.last_read_message_id ?? null,
            lastReadAt: row.last_read_at,
          });
        }
      },
    )
    .subscribe((status) => {
      handlers.onStatusChange(status);
    });

  return channel;
}
