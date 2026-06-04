export function normalizeProposalStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toUpperCase();
}

export function hasActiveServiceRequestProposal(
  proposalId: string | null | undefined,
  status: string | null | undefined,
): boolean {
  if (!proposalId) return false;
  return normalizeProposalStatus(status) !== "REVISED";
}

export function canEditServiceRequestProposal(status: string | null | undefined): boolean {
  const normalized = normalizeProposalStatus(status);
  return normalized === "PENDING" || normalized === "REVISION_REQUESTED";
}

export function isRejectedProposalStatus(status: string | null | undefined): boolean {
  const normalized = normalizeProposalStatus(status);
  return normalized === "REJECTED" || normalized === "REJECTED_AUTOMATICALLY";
}

export function isPendingProposalStatus(status: string | null | undefined): boolean {
  const normalized = normalizeProposalStatus(status);
  return normalized === "PENDING" || normalized === "SUBMITTED";
}
