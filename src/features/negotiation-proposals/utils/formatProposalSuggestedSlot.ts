import type { ProposalSuggestedSlotRpc } from "../types/proposals.types";
import {
  formatProposalDateOnly,
  translateProposalShift,
} from "./proposalDetailsFormatters";

export function formatProposalSuggestedSlot(slot: ProposalSuggestedSlotRpc): string {
  const startLabel = formatProposalDateOnly(slot.start_date);
  const shiftLabel = translateProposalShift(slot.shift);

  if (slot.end_date && slot.end_date !== slot.start_date) {
    const endLabel = formatProposalDateOnly(slot.end_date);
    return `${startLabel} – ${endLabel} · ${shiftLabel}`;
  }

  return `${startLabel} · ${shiftLabel}`;
}
