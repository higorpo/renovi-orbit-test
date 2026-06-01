import type { ProposalRevisionReason, ProposalStatus } from "@/features/negotiation-proposals";

export interface TimelineHydratedProposal {
  id: string;
  chat_id: string;
  service_request_id: string;
  provider_id: string;
  status: ProposalStatus;
  version: number;
  revision_count: number;
  revision_reason: ProposalRevisionReason | null;
  revision_notes: string | null;
  submitted_at: string | null;
  expired_at: string | null;
  proposed_amount: number;
  tax_rate: number;
  tax_amount: number;
  final_amount: number;
  proposal_description: string | null;
  proposal_duration_unit: string | null;
  proposal_duration_value: number | null;
  client_response_deadline_at: string | null;
  created_at: string;
  updated_at: string;
}
