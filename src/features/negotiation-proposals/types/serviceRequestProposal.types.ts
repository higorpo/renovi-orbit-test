import type { ProposalRevisionReason, ProposalSuggestedSlotRpc } from "./proposals.types";
import type { ProposalDurationUnit } from "./proposalComposer.types";

export interface ServiceRequestProposalDraft {
  proposedAmount: number | null;
  description: string | null;
  durationValue: number | null;
  durationUnit: ProposalDurationUnit | null;
  suggestedSlots: ProposalSuggestedSlotRpc[] | null;
  photos: string[] | null;
}

export interface ServiceRequestProposalSummary {
  serviceRequestId: string;
  proposalId: string;
  isLatestProposal: boolean;
  status: string | null;
  proposedAmount: number | null;
  taxRate: number | null;
  taxAmount: number | null;
  description: string | null;
  photos: string[] | null;
  clientRejectionResponse: string | null;
  revisionReason: ProposalRevisionReason | null;
  revisionNotes: string | null;
}

/** PostgREST row for the provider's latest proposal on a service request. */
export interface ProviderLatestProposalRow {
  id: string;
  service_request_id: string;
  status: string;
  proposed_amount: number;
  tax_rate: number;
  tax_amount: number;
  proposal_description: string;
  photos: string[];
  client_rejection_response: string | null;
  revision_reason: ProposalRevisionReason | null;
  revision_notes: string | null;
  proposal_duration_value: number;
  proposal_duration_unit: ProposalDurationUnit;
  proposal_suggested_slots: ProposalSuggestedSlotRpc[] | unknown;
  version: number;
}

export interface ProviderLatestProposal {
  summary: ServiceRequestProposalSummary;
  draft: ServiceRequestProposalDraft;
}
