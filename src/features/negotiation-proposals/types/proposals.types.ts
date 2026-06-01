import type { Database } from "@/lib/supabase/database.types";

export type ProposalStatus = Database["public"]["Enums"]["proposal_status"];
export type ProposalRevisionReason = Database["public"]["Enums"]["proposal_revision_reason"];

export type ProviderProposalRow = Database["public"]["Tables"]["provider_proposals"]["Row"];

export type ProposalSuggestedSlotShift = "morning" | "afternoon" | "full_day";

/** RPC wire format (submit_proposal / accept_proposal). */
export interface ProposalSuggestedSlotRpc {
  start_date: string;
  end_date?: string | null;
  shift: ProposalSuggestedSlotShift;
}

export interface ProposalPricingInput {
  pricing_signature: string;
  tax_rate: number;
  tax_amount: number;
  final_amount: number;
}

export interface ProposalVersionListItem {
  id: string;
  chat_id: string;
  version: number;
  status: ProposalStatus;
  proposed_amount: number;
  final_amount: number;
  revision_count: number;
  revision_reason: ProposalRevisionReason | null;
  submitted_at: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalVersionListResponse {
  items: ProposalVersionListItem[];
}

export interface SubmitProposalResultProposal {
  id: string;
  chat_id: string;
  service_request_id: string;
  provider_id: string;
  status: ProposalStatus;
  version: number;
  revision_count: number;
  submitted_at: string | null;
  proposed_amount: number;
  final_amount: number;
  proposal_suggested_slots: unknown;
}

export interface SubmitProposalResultTimelineMessage {
  id: string;
  chat_id: string;
  message_type: string;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  created_at: string;
}

export interface SubmitProposalResult {
  proposal: SubmitProposalResultProposal;
  timeline_message: SubmitProposalResultTimelineMessage;
}

export interface AcceptProposalResultService {
  id: string;
  service_request_id: string;
  accepted_proposal_id: string;
  status: string;
  scheduled_start_date: string;
  scheduled_shift: string | null;
  agreed_slot: ProposalSuggestedSlotRpc;
}

export interface AcceptProposalResultProposal {
  id: string;
  status: ProposalStatus;
  selected_slot: ProposalSuggestedSlotRpc;
  provider_id: string;
  chat_id: string;
}

export interface AcceptProposalResult {
  service: AcceptProposalResultService;
  proposal: AcceptProposalResultProposal;
}

export interface ProposalMutationResult {
  proposal: {
    id: string;
    status: ProposalStatus;
    chat_id: string;
    service_request_id?: string;
    client_rejection_response?: string | null;
    revision_reason?: ProposalRevisionReason | null;
    revision_notes?: string | null;
    rejected_at?: string;
  };
}

export const PROPOSAL_BUSINESS_ERROR_CODES = [
  "FREE_MESSAGING_DISABLED_PROPOSAL_PENDING",
  "NO_ACTIVE_SLOT",
  "SR_NOT_OPEN",
  "SR_ALREADY_COMPLETED",
  "CONVERSATION_CLOSED",
  "CONVERSATION_NOT_FOUND",
  "NOT_A_PARTICIPANT",
  "RATE_LIMITED",
  "REVISION_LIMIT_EXCEEDED",
  "PROPOSAL_EXPIRED",
  "PROPOSAL_NOT_ACCEPTABLE",
  "PROPOSAL_ALREADY_PENDING",
] as const;

export type ProposalBusinessErrorCode = (typeof PROPOSAL_BUSINESS_ERROR_CODES)[number];

export interface ProposalsApiError {
  message: string;
  code: ProposalBusinessErrorCode | "UNKNOWN";
  retryAfterSeconds?: number;
}

export interface ProposalsApiResult<T> {
  data: T | null;
  error: ProposalsApiError | null;
}
