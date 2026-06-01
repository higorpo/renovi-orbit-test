/**
 * CNS RPC names — single source for chats.api.ts (task 86).
 * All mutations and reads go through supabase.rpc; no direct table writes from the client.
 */
export const CNS_CHAT_RPC = {
  sendMessage: "cns_send_message",
  initiateConversation: "cns_initiate_conversation",
  closeConversation: "cns_close_conversation",
  markConversationRead: "cns_mark_conversation_read",
  listConversations: "list_conversations",
  listChatMessages: "list_chat_messages",
  getConversationDetail: "get_conversation_detail",
  chatFreeMessagingAllowed: "cns_chat_free_messaging_allowed",
  getProposalForTimeline: "get_proposal_for_timeline",
} as const;

export type CnsChatRpcName = (typeof CNS_CHAT_RPC)[keyof typeof CNS_CHAT_RPC];
