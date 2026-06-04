import { CalendarDays, CheckCircle2, CircleDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProfileRole } from "@/features/auth";
import {
  formatProposalSuggestedSlot,
  type ProposalSuggestedSlotRpc,
} from "@/features/negotiation-proposals";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import type { ConversationAcceptedProposalSummary } from "../../types/chats.types";
import { CHAT_ACCEPTED_PROPOSAL_COPY } from "../../utils/chatDetailsCopy";

export interface ChatDetailsAcceptedProposalSectionProps {
  acceptedProposal: ConversationAcceptedProposalSummary;
  viewerRole: ProfileRole;
  onViewDetails: (proposalId: string) => void;
  className?: string;
}

function resolveAcceptedProposalAmount(
  acceptedProposal: ConversationAcceptedProposalSummary,
  viewerRole: ProfileRole,
): { label: string; value: number } {
  if (viewerRole === "provider" && typeof acceptedProposal.final_amount === "number") {
    return {
      label: CHAT_ACCEPTED_PROPOSAL_COPY.providerAmountLabel,
      value: acceptedProposal.final_amount,
    };
  }

  return {
    label: CHAT_ACCEPTED_PROPOSAL_COPY.amountLabel,
    value: acceptedProposal.proposed_amount,
  };
}

export function ChatDetailsAcceptedProposalSection({
  acceptedProposal,
  viewerRole,
  onViewDetails,
  className,
}: ChatDetailsAcceptedProposalSectionProps) {
  const amount = resolveAcceptedProposalAmount(acceptedProposal, viewerRole);
  const slotLabel = acceptedProposal.selected_slot
    ? formatProposalSuggestedSlot(acceptedProposal.selected_slot as ProposalSuggestedSlotRpc)
    : CHAT_ACCEPTED_PROPOSAL_COPY.slotUnavailable;

  return (
    <section className={cn("space-y-3", className)}>
      <h2 className="text-sm font-semibold text-foreground">
        {CHAT_ACCEPTED_PROPOSAL_COPY.sectionTitle}
      </h2>

      <div className="space-y-4 rounded-2xl border border-emerald-600/40 bg-emerald-500/5 p-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
          <p className="text-sm font-medium text-foreground">
            {CHAT_ACCEPTED_PROPOSAL_COPY.headline}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-600/25 bg-background/80 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CircleDollarSign className="h-3.5 w-3.5" aria-hidden />
              {amount.label}
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {formatCurrency(amount.value)}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-600/25 bg-background/80 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {CHAT_ACCEPTED_PROPOSAL_COPY.slotLabel}
            </p>
            <p className="mt-1 text-base font-semibold leading-snug text-foreground">
              {slotLabel}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-full"
          onClick={() => onViewDetails(acceptedProposal.id)}
        >
          {CHAT_ACCEPTED_PROPOSAL_COPY.viewDetailsAction}
        </Button>
      </div>
    </section>
  );
}
