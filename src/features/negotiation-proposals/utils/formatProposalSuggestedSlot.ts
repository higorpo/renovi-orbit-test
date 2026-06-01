import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ProposalSuggestedSlotRpc } from "../types/proposals.types";

const SHIFT_LABELS: Record<ProposalSuggestedSlotRpc["shift"], string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  full_day: "Dia inteiro",
};

export function formatProposalSuggestedSlot(slot: ProposalSuggestedSlotRpc): string {
  const startLabel = format(parseISO(slot.start_date), "dd/MM/yyyy", { locale: ptBR });
  const shiftLabel = SHIFT_LABELS[slot.shift] ?? slot.shift;

  if (slot.end_date && slot.end_date !== slot.start_date) {
    const endLabel = format(parseISO(slot.end_date), "dd/MM/yyyy", { locale: ptBR });
    return `${startLabel} – ${endLabel} · ${shiftLabel}`;
  }

  return `${startLabel} · ${shiftLabel}`;
}
