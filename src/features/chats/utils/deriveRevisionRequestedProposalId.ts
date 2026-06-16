import { coerceProposalStatus } from "@/features/negotiation-proposals/constants/proposalStatus";
import type { ProposalStatus } from "@/features/negotiation-proposals";

export function deriveRevisionRequestedProposalId(
  proposalId: string | null,
  proposalStatus: ProposalStatus | string | null | undefined,
): string | null {
  if (!proposalId) return null;
  return coerceProposalStatus(proposalStatus) === "REVISION_REQUESTED" ? proposalId : null;
}
