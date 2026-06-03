import type { Database } from "@/lib/supabase/database.types";
import type { ProposalDurationUnit } from "./proposalComposer.types";

export type ProposalStatus = Database["public"]["Enums"]["proposal_status"];
export type ProposalRevisionReason = Database["public"]["Enums"]["proposal_revision_reason"];

export type ProposalSuggestedSlotShift = "morning" | "afternoon" | "full_day";

/** Wire format for suggested slots in RPC args/responses. */
export interface ProposalSuggestedSlotRpc {
  start_date: string;
  end_date?: string | null;
  shift: ProposalSuggestedSlotShift;
}

export interface ProposalVersionListItem {
  id: string;
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

/** `create_provider_proposal` RPC response. */
export interface CreateProviderProposalResult {
  id: string;
  proposal: {
    id: string;
    service_request_id: string;
    provider_id: string;
    status: ProposalStatus;
    version: number;
    revision_count: number;
    submitted_at: string | null;
    proposed_amount: number;
    final_amount: number;
    proposal_suggested_slots: unknown;
  };
  timeline_message: {
    id: string;
    chat_id: string;
    message_type: string;
    linked_entity_type: string | null;
    linked_entity_id: string | null;
    created_at: string;
  } | null;
}

/** `accept_proposal` RPC response. */
export interface AcceptProposalResult {
  service: {
    id: string;
    service_request_id: string;
    accepted_proposal_id: string;
    status: string;
    scheduled_start_date: string;
    scheduled_shift: string | null;
    agreed_slot: ProposalSuggestedSlotRpc;
  };
  proposal: {
    id: string;
    status: ProposalStatus;
    selected_slot: ProposalSuggestedSlotRpc;
    provider_id: string;
  };
}

/** `reject_proposal`, `request_proposal_revision`, `decline_revision_request` responses. */
export interface ProposalMutationResult {
  proposal: {
    id: string;
    status: ProposalStatus;
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

/** Subset of `provider_proposals` returned by history selects in provider-jobs. */
export interface ProviderProposalHistoryItem {
  id: string;
  proposed_amount: number;
  proposal_description: string;
  proposal_duration_value: number;
  proposal_duration_unit: ProposalDurationUnit;
  proposal_suggested_slots: ProposalSuggestedSlotRpc[];
  status: ProposalStatus;
  tax_rate: number;
  tax_amount: number;
  final_amount: number;
  photos: string[];
  created_at: string;
  updated_at: string;
  client_rejection_response: string | null;
}

export interface CreateProviderProposalParams {
  serviceRequestId: string;
  proposedAmount: number;
  proposalDescription: string;
  proposalDurationValue: number;
  proposalDurationUnit: ProposalDurationUnit;
  proposalSuggestedSlots: ProposalSuggestedSlotRpc[];
  photos: string[];
  pricing: {
    original_amount: number;
    tax_rate: number;
    tax_amount: number;
    final_amount: number;
    pricing_signature: string;
  };
}
