import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type ConversationRealtimeHandlers = {
  onMessageInsert: (payload: { id: string }) => void;
  onProposalUpdate: (payload: { id: string }) => void;
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
    .subscribe((status) => {
      handlers.onStatusChange(status);
    });

  return channel;
}
