import type { ProviderJobItem } from "../types/provider-jobs.types";
import type { ServiceRequestProposalSummary } from "@/features/negotiation-proposals";

export function mapProviderJobToProposalSummary(
  job: ProviderJobItem,
): ServiceRequestProposalSummary | null {
  if (!job.provider_proposal_id) return null;

  return {
    serviceRequestId: job.id,
    proposalId: job.provider_proposal_id,
    isLatestProposal: job.is_latest_provider_proposal !== false,
    status: job.provider_proposal_status,
    proposedAmount: job.provider_proposed_amount,
    taxRate: job.provider_tax_rate,
    taxAmount: job.provider_tax_amount,
    description: job.provider_proposal_description,
    photos: job.provider_proposal_photos,
    clientRejectionResponse: job.provider_proposal_client_rejection_response,
    revisionReason: job.provider_proposal_revision_reason,
    revisionNotes: job.provider_proposal_revision_notes,
  };
}
