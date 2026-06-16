import { coerceProposalStatus } from "../constants/proposalStatus";
import type { ProposalStatus } from "../types/proposals.types";

export function normalizeProposalStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toUpperCase();
}

export function resolveProposalStatus(
  status: string | null | undefined,
): ProposalStatus | null {
  return coerceProposalStatus(status);
}

export function hasActiveServiceRequestProposal(
  proposalId: string | null | undefined,
  status: string | null | undefined,
): boolean {
  if (!proposalId) return false;
  return resolveProposalStatus(status) !== "REVISED";
}

export function canEditServiceRequestProposal(status: string | null | undefined): boolean {
  const resolved = resolveProposalStatus(status);
  return resolved === "PENDING" || resolved === "REVISION_REQUESTED";
}

export function isRejectedProposalStatus(status: string | null | undefined): boolean {
  const resolved = resolveProposalStatus(status);
  return resolved === "REJECTED" || resolved === "REJECTED_AUTOMATICALLY";
}

export function isPendingProposalStatus(status: string | null | undefined): boolean {
  return resolveProposalStatus(status) === "PENDING";
}
