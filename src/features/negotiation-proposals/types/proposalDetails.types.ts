import type { ProposalRevisionReason, ProposalStatus, ProposalSuggestedSlotRpc } from "./proposals.types";

export type ProposalDetailAudience = "client" | "provider";

export interface ProposalDetailView {
  id: string;
  service_request_id: string;
  provider_id: string;
  status: ProposalStatus;
  version: number;
  revision_count: number;
  revision_reason: ProposalRevisionReason | null;
  revision_notes: string | null;
  submitted_at: string | null;
  expired_at: string | null;
  /** Client-response deadline: coalesce(submitted_at, created_at) + SLA hours. */
  expires_at: string | null;
  proposed_amount: number;
  tax_rate?: number;
  tax_amount?: number;
  final_amount?: number;
  proposal_description: string | null;
  proposal_duration_unit: string | null;
  proposal_duration_value: number | null;
  proposal_suggested_slots: ProposalSuggestedSlotRpc[];
  selected_slot: ProposalSuggestedSlotRpc | null;
  photos: string[];
  client_rejection_response: string | null;
  created_at: string;
  updated_at: string;
}
