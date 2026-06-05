import type { Database } from "@/lib/supabase/database.types";

export const CHAT_ANALYTICS_SCHEMA_VERSION = "v1" as const;

export const CHAT_ANALYTICS_EVENT_NAMES = [
  "negotiation_message_sent",
  "proposal_submitted",
  "proposal_accepted",
  "proposal_rejected",
  "revision_requested",
  "conversation_closed",
] as const;

export type ChatAnalyticsEventName = (typeof CHAT_ANALYTICS_EVENT_NAMES)[number];

export type ChatAnalyticsScalar = string | number | boolean | undefined;

export type ChatAnalyticsProperties = Record<string, ChatAnalyticsScalar>;

type CnsClosureType = Database["public"]["Enums"]["cns_closure_type"];
type CnsMessageType = Database["public"]["Enums"]["cns_message_type"];
type ProposalRevisionReason = Database["public"]["Enums"]["proposal_revision_reason"];

export type NegotiationMessageSentProperties = {
  message_id: string;
  message_type: CnsMessageType;
  chat_id: string;
  service_request_id: string;
};

export type ProposalSubmittedProperties = {
  proposal_id: string;
  chat_id: string;
  service_request_id: string;
  version: number;
  revision_count: number;
  time_to_proposal_ms?: number;
};

export type ProposalAcceptedProperties = {
  proposal_id: string;
  chat_id: string;
  service_request_id: string;
  service_id?: string;
};

export type ProposalRejectedProperties = {
  proposal_id: string;
  chat_id: string;
  service_request_id: string;
};

export type RevisionRequestedProperties = {
  proposal_id: string;
  chat_id: string;
  service_request_id: string;
  revision_reason: ProposalRevisionReason;
};

export type ConversationClosedProperties = {
  chat_id: string;
  service_request_id: string;
  closure_type: CnsClosureType;
};

export type ChatAnalyticsEventProperties = {
  negotiation_message_sent: NegotiationMessageSentProperties;
  proposal_submitted: ProposalSubmittedProperties;
  proposal_accepted: ProposalAcceptedProperties;
  proposal_rejected: ProposalRejectedProperties;
  revision_requested: RevisionRequestedProperties;
  conversation_closed: ConversationClosedProperties;
};

export type ChatAnalyticsPayload<TEvent extends ChatAnalyticsEventName = ChatAnalyticsEventName> = {
  event: TEvent;
  schema_version: typeof CHAT_ANALYTICS_SCHEMA_VERSION;
} & ChatAnalyticsEventProperties[TEvent];

const FORBIDDEN_PROPERTY_KEYS = new Set([
  "text",
  "message",
  "body",
  "content",
  "email",
  "phone",
  "name",
  "full_name",
  "address",
  "street",
  "cep",
  "postal_code",
  "notes",
  "closure_reason",
  "sender_user_id",
  "closed_by_user_id",
  "client_id",
  "provider_id",
]);

export function isChatAnalyticsEventName(value: string): value is ChatAnalyticsEventName {
  return (CHAT_ANALYTICS_EVENT_NAMES as readonly string[]).includes(value);
}

export function sanitizeChatAnalyticsProperties(
  properties: Record<string, unknown>,
): ChatAnalyticsProperties {
  const sanitized: ChatAnalyticsProperties = {};

  for (const [key, value] of Object.entries(properties)) {
    if (FORBIDDEN_PROPERTY_KEYS.has(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function buildChatAnalyticsPayload<TEvent extends ChatAnalyticsEventName>(
  eventName: TEvent,
  properties: ChatAnalyticsEventProperties[TEvent],
): ChatAnalyticsPayload<TEvent> {
  return {
    event: eventName,
    schema_version: CHAT_ANALYTICS_SCHEMA_VERSION,
    ...sanitizeChatAnalyticsProperties(properties as Record<string, unknown>),
  } as ChatAnalyticsPayload<TEvent>;
}
