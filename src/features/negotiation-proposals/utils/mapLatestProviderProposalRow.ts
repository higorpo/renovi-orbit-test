import type { ProposalSuggestedSlotRpc } from "../types/proposals.types";
import type {
  ProviderLatestProposal,
  ProviderLatestProposalRow,
  ServiceRequestProposalDraft,
} from "../types/serviceRequestProposal.types";
import type { ProposalDurationUnit } from "../types/proposalComposer.types";

function parseSuggestedSlots(value: unknown): ProposalSuggestedSlotRpc[] | null {
  if (!Array.isArray(value)) return null;
  return value as ProposalSuggestedSlotRpc[];
}

function mapRowToDraft(row: ProviderLatestProposalRow): ServiceRequestProposalDraft {
  return {
    proposedAmount: row.proposed_amount,
    description: row.proposal_description,
    durationValue: row.proposal_duration_value,
    durationUnit: row.proposal_duration_unit as ProposalDurationUnit,
    suggestedSlots: parseSuggestedSlots(row.proposal_suggested_slots),
    photos: row.photos,
  };
}

export function mapLatestProviderProposalRow(
  row: ProviderLatestProposalRow,
): ProviderLatestProposal {
  return {
    summary: {
      serviceRequestId: row.service_request_id,
      proposalId: row.id,
      isLatestProposal: true,
      status: row.status,
      proposedAmount: row.proposed_amount,
      taxRate: row.tax_rate,
      taxAmount: row.tax_amount,
      description: row.proposal_description,
      photos: row.photos,
      clientRejectionResponse: row.client_rejection_response,
      revisionReason: row.revision_reason,
      revisionNotes: row.revision_notes,
    },
    draft: mapRowToDraft(row),
  };
}
