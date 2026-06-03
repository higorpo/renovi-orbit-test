import { Eye } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatCurrency";
import { PROPOSAL_COPY_VARIANTS, type ProposalCopyVariant } from "../constants/proposalCopyVariants";
import type { ProviderProposalHistoryItem } from "../types/proposals.types";
import { getProposalStatusLabel } from "../utils/proposalDetailsFormatters";

interface ProposalHistoryAccordionProps {
  copyVariant?: ProposalCopyVariant;
  historyOpen: boolean;
  proposalHistory: ProviderProposalHistoryItem[];
  isHistoryLoading: boolean;
  isHistoryError: boolean;
  onHistoryOpenChange: (open: boolean) => void;
  onProposalSelect: (proposal: ProviderProposalHistoryItem) => void;
}

export function ProposalHistoryAccordion({
  copyVariant = "budget",
  historyOpen,
  proposalHistory,
  isHistoryLoading,
  isHistoryError,
  onHistoryOpenChange,
  onProposalSelect,
}: ProposalHistoryAccordionProps) {
  const copy = PROPOSAL_COPY_VARIANTS[copyVariant];

  return (
    <Accordion
      type="single"
      collapsible
      value={historyOpen ? "proposal-history" : ""}
      onValueChange={(value) => onHistoryOpenChange(value === "proposal-history")}
    >
      <AccordionItem value="proposal-history">
        <AccordionTrigger>{copy.historyTrigger}</AccordionTrigger>
        <AccordionContent>
          {isHistoryLoading && (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {!isHistoryLoading && isHistoryError && (
            <p className="text-sm text-muted-foreground">{copy.loadingHistory}</p>
          )}

          {!isHistoryLoading && !isHistoryError && proposalHistory.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{copy.emptyHistory}</p>
          )}

          {!isHistoryLoading && !isHistoryError && proposalHistory.length > 0 && (
            <div className="space-y-2">
              {proposalHistory.map((proposal) => (
                <div key={proposal.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(proposal.proposed_amount)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {proposal.proposal_description}
                      </p>
                      <p className="mt-2 text-xs font-medium text-foreground">
                        Status: {getProposalStatusLabel(proposal.status)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={copy.historyDetailsAria}
                      onClick={() => onProposalSelect(proposal)}
                    >
                      <Eye className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
