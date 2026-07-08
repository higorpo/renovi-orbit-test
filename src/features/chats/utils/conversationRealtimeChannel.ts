import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type ConversationRealtimeScope = {
  /** Required to subscribe to provider_proposals UPDATE (chat_id was removed from that table). */
  serviceRequestId?: string | null;
  /** Narrows proposal updates to this chat's provider when set. */
  providerId?: string | null;
};

export type ConversationRealtimeHandlers = {
  onMessageInsert: (payload: { id: string }) => void;
  onProposalUpdate: (payload: { id: string }) => void;
  onRescheduleRequestChange: (payload: {
    id: string;
    status: string;
    updatedAt: string;
  }) => void;
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
  scope?: ConversationRealtimeScope,
): RealtimeChannel {
  const channel = client.channel(conversationChannelName(chatId));
  const serviceRequestId = scope?.serviceRequestId ?? null;
  const providerId = scope?.providerId ?? null;

  channel.on(
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
  );

  if (serviceRequestId) {
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "provider_proposals",
        filter: `service_request_id=eq.${serviceRequestId}`,
      },
      (payload) => {
        const row = payload.new as { id?: string; provider_id?: string } | null;
        const id = row?.id;
        if (!id) return;
        if (providerId && row.provider_id !== providerId) return;
        handlers.onProposalUpdate({ id });
      },
    );
  }

  const handleRescheduleRequestRow = (payload: { new: Record<string, unknown> | null }) => {
    const row = payload.new as { id?: string; status?: string; updated_at?: string } | null;
    const id = row?.id;
    const status = row?.status;
    const updatedAt = row?.updated_at;
    if (id && status && updatedAt) {
      handlers.onRescheduleRequestChange({ id, status, updatedAt });
    }
  };

  channel.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "service_reschedule_requests",
      filter: `chat_id=eq.${chatId}`,
    },
    handleRescheduleRequestRow,
  );

  channel.on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "service_reschedule_requests",
      filter: `chat_id=eq.${chatId}`,
    },
    handleRescheduleRequestRow,
  );

  channel
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
