import type { ProposalDetailView } from "../types/proposalDetails.types";
import type { ServiceRequestProposalSummary } from "../types/serviceRequestProposal.types";
import { normalizeProposalStatus } from "./proposalStatus";

export function mapProposalDetailToSummary(
  proposal: ProposalDetailView,
): ServiceRequestProposalSummary {
  const status = normalizeProposalStatus(proposal.status);

  return {
    serviceRequestId: proposal.service_request_id,
    proposalId: proposal.id,
    isLatestProposal: status !== "REVISED",
    status: proposal.status,
    proposedAmount: proposal.proposed_amount,
    taxRate: proposal.tax_rate ?? null,
    taxAmount: proposal.tax_amount ?? null,
    description: proposal.proposal_description,
    photos: proposal.photos,
    clientRejectionResponse: proposal.client_rejection_response,
  };
}
