import { CalendarDays } from "lucide-react";
import type { ProposalSuggestedSlotRpc } from "../types/proposals.types";
import { formatProposalSuggestedSlot } from "../utils/formatProposalSuggestedSlot";

export interface ProposalSuggestedSlotsListProps {
  slots: ProposalSuggestedSlotRpc[];
  heading?: string;
}

export function ProposalSuggestedSlotsList({
  slots,
  heading = "Datas sugeridas para execução",
}: ProposalSuggestedSlotsListProps) {
  if (slots.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {heading}
      </p>
      <ul className="space-y-2">
        {slots.map((slot, index) => (
          <li
            key={`${slot.start_date}-${slot.end_date ?? "single"}-${slot.shift}-${index}`}
            className="rounded-lg border border-border/60 bg-background px-3 py-2.5"
          >
            <p className="text-sm leading-snug text-foreground">
              {slots.length > 1 ? (
                <span className="font-medium">Opção {index + 1}: </span>
              ) : null}
              {formatProposalSuggestedSlot(slot)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
