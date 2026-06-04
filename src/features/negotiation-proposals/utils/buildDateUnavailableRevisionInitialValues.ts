import type {
  ProposalSuggestedSlotRpc,
  RevisionRequestInitialValues,
} from "../types/proposals.types";
import { formatProposalSuggestedSlot } from "./formatProposalSuggestedSlot";

export function buildDateUnavailableRevisionInitialValues(
  suggestedSlots: ProposalSuggestedSlotRpc[],
): RevisionRequestInitialValues {
  const formattedSlots = suggestedSlots.map(formatProposalSuggestedSlot);
  const slotLines =
    formattedSlots.length > 0
      ? formattedSlots.map((slot) => `• ${slot}`).join("\n")
      : null;

  const revisionNotes = slotLines
    ? `Nenhuma das datas sugeridas pelo prestador funciona para mim:\n${slotLines}\n\n`
    : "Nenhuma das datas sugeridas pelo prestador funciona para mim.\n\n";

  return {
    revisionReason: "DATE_NOT_AVAILABLE",
    revisionNotes,
  };
}
