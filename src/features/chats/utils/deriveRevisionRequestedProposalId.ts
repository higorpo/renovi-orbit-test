import type { ProposalStatus } from "@/features/negotiation-proposals";

export function deriveRevisionRequestedProposalId(
  proposalId: string | null,
  proposalStatus: ProposalStatus | string | null | undefined,
): string | null {
  if (!proposalId || proposalStatus !== "REVISION_REQUESTED") return null;
  return proposalId;
}
