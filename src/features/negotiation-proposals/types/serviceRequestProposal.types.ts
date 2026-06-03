import type { ProposalSuggestedSlotRpc } from "./proposals.types";
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
}
