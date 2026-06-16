import type { ProposalSuggestedSlotRpc } from "../types/proposals.types";

export function parseProposalSuggestedSlots(value: unknown): ProposalSuggestedSlotRpc[] {
  if (!Array.isArray(value)) return [];
  return value as ProposalSuggestedSlotRpc[];
}
