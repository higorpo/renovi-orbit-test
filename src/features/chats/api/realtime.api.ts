import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import {
  subscribeConversationChannel,
  type ConversationRealtimeHandlers,
  type ConversationRealtimeScope,
} from "../utils/conversationRealtimeChannel";
import {
  subscribeInboxChannel,
  type InboxRealtimeHandlers,
} from "../utils/inboxRealtimeChannel";
import { conversationPresenceChannelName } from "../utils/typingPresence";

export type { InboxRealtimeHandlers, ConversationRealtimeHandlers, ConversationRealtimeScope };

export function subscribeInboxRealtime(
  userId: string,
  handlers: InboxRealtimeHandlers,
): RealtimeChannel {
  return subscribeInboxChannel(supabase, userId, handlers);
}

export function subscribeConversationRealtime(
  chatId: string,
  handlers: ConversationRealtimeHandlers,
  scope?: ConversationRealtimeScope,
): RealtimeChannel {
  return subscribeConversationChannel(supabase, chatId, handlers, scope);
}

export function createConversationPresenceChannel(
  conversationId: string,
  currentUserId: string,
): RealtimeChannel {
  return supabase.channel(conversationPresenceChannelName(conversationId), {
    config: { presence: { key: currentUserId } },
  });
}

export function removeRealtimeChannel(channel: RealtimeChannel): void {
  void supabase.removeChannel(channel);
}

export async function teardownPresenceChannel(channel: RealtimeChannel): Promise<void> {
  await channel.untrack().catch(() => undefined);
  removeRealtimeChannel(channel);
}
