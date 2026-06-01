import type { Database } from "@/lib/supabase/database.types";

export type CnsClosureType = Database["public"]["Enums"]["cns_closure_type"];
export type CnsConversationStatus = Database["public"]["Enums"]["cns_conversation_status"];
export type CnsDeliveryStatus = Database["public"]["Enums"]["cns_delivery_status"];
export type CnsInactivationReason = Database["public"]["Enums"]["cns_inactivation_reason"];
export type CnsMessageType = Database["public"]["Enums"]["cns_message_type"];

export type ChatRow = Database["public"]["Tables"]["chats"]["Row"];
export type ChatMessageRow = Database["public"]["Tables"]["chat_messages"]["Row"];

export interface ConversationCounterparty {
  id: string;
  full_name: string | null;
  profile_image_path: string | null;
  role: Database["public"]["Tables"]["profiles"]["Row"]["role"];
}

export interface ConversationServiceSummary {
  id: string;
  title: string;
  slug: string;
  icon_key: string | null;
  color_key: string | null;
  image_url: string | null;
}

export interface ConversationLastMessagePreview {
  id: string;
  message_type: CnsMessageType;
  created_at: string;
  preview_text: string;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
}

export interface ConversationListItem {
  id: string;
  service_request_id: string;
  client_id: string;
  provider_id: string;
  status: CnsConversationStatus;
  last_interaction_at: string;
  activated_at: string | null;
  inactivated_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  counterparty: ConversationCounterparty;
  service_request_title: string;
  service: ConversationServiceSummary;
  last_message: ConversationLastMessagePreview | null;
  is_unread: boolean;
  last_read_at: string | null;
}

export interface ConversationListCursor {
  last_interaction_at: string;
  id: string;
}

export interface ConversationListResponse {
  items: ConversationListItem[];
  has_more: boolean;
  next_cursor: ConversationListCursor | null;
}

export interface ChatMessageCursor {
  created_at: string;
  id: string;
}

export interface ChatMessageListItem {
  id: string;
  chat_id: string;
  sender_user_id: string;
  message_type: CnsMessageType;
  payload: Record<string, unknown>;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  idempotency_key: string;
  delivery_status: CnsDeliveryStatus;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageListResponse {
  items: ChatMessageListItem[];
  has_more: boolean;
  next_cursor: ChatMessageCursor | null;
}

export interface ConversationDetailSnapshot {
  id: string;
  service_request_id: string;
  client_id: string;
  provider_id: string;
  status: CnsConversationStatus;
  last_interaction_at: string;
  activated_at: string | null;
  inactivated_at: string | null;
  inactivation_reason: CnsInactivationReason | null;
  closed_at: string | null;
  closure_type: CnsClosureType | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationServiceRequestSummary {
  id: string;
  title: string;
  description: string | null;
  photos: string[];
  urgency: string | null;
  status: Database["public"]["Enums"]["service_request_status"];
  scope_complexity: string | null;
  estimated_duration_hint: string | null;
  created_at: string;
}

export interface ConversationCategorySummary {
  id: string;
  title: string;
  slug: string;
  icon_key: string | null;
  color_key: string | null;
}

export interface ConversationMaskedAddress {
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

export interface ConversationDetailResponse {
  conversation: ConversationDetailSnapshot;
  counterparty: ConversationCounterparty;
  service_request: ConversationServiceRequestSummary;
  service: ConversationServiceSummary;
  category: ConversationCategorySummary | null;
  address: ConversationMaskedAddress;
}

export interface SendMessageResultMessage {
  id: string;
  chat_id: string;
  sender_user_id: string;
  message_type: CnsMessageType;
  payload: Record<string, unknown>;
  idempotency_key: string;
  created_at: string;
}

export interface SendMessageResultConversation {
  id: string;
  service_request_id: string;
  client_id: string;
  provider_id: string;
  status: CnsConversationStatus;
  last_interaction_at: string;
}

export interface SendMessageResult {
  message: SendMessageResultMessage;
  conversation: SendMessageResultConversation;
}

export interface MarkConversationReadResult {
  last_read_at: string;
}

export const CNS_BUSINESS_ERROR_CODES = [
  "FREE_MESSAGING_DISABLED_PROPOSAL_PENDING",
  "NO_ACTIVE_SLOT",
  "SR_NOT_OPEN",
  "CONVERSATION_CLOSED",
  "CONVERSATION_NOT_FOUND",
  "NOT_A_PARTICIPANT",
  "INVALID_MESSAGE_ID",
  "RATE_LIMITED",
  "REVISION_LIMIT_EXCEEDED",
  "PROPOSAL_EXPIRED",
] as const;

export type CnsBusinessErrorCode = (typeof CNS_BUSINESS_ERROR_CODES)[number];

export interface ChatsApiError {
  message: string;
  code: CnsBusinessErrorCode | "UNKNOWN";
  retryAfterSeconds?: number;
}

export interface ChatsApiResult<T> {
  data: T | null;
  error: ChatsApiError | null;
}
