import type { ProposalStatus } from "../types/proposals.types";

/** Canonical enum values from `Database["public"]["Enums"]["proposal_status"]`. */
export const PROPOSAL_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "REVISION_REQUESTED",
  "REVISED",
  "REJECTED_AUTOMATICALLY",
] as const satisfies readonly ProposalStatus[];

/** Ensures every `ProposalStatus` has an entry when the DB enum changes. */
export function defineProposalStatusMap<T>(
  map: Record<ProposalStatus, T>,
): Record<ProposalStatus, T> {
  return map;
}

export function isProposalStatus(value: string): value is ProposalStatus {
  return (PROPOSAL_STATUSES as readonly string[]).includes(value);
}

export function coerceProposalStatus(
  status: string | null | undefined,
): ProposalStatus | null {
  if (!status) return null;

  const normalized = status.trim().toUpperCase();
  return isProposalStatus(normalized) ? normalized : null;
}

export function assertProposalStatusExhaustive(value: never): never {
  throw new Error(`Unhandled proposal status: ${String(value)}`);
}
