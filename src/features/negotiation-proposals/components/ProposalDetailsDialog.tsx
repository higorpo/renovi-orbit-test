import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { PROPOSAL_COPY_VARIANTS, type ProposalCopyVariant } from "../constants/proposalCopyVariants";
import { useProposalPhotoUrls } from "../hooks/useProposalPhotoUrls";
import type { ProposalDetailAudience } from "../types/proposalDetails.types";
import type { ProposalDetailView } from "../types/proposalDetails.types";
import type { ProviderProposalHistoryItem } from "../types/proposals.types";
import type { ServiceRequestProposalSummary } from "../types/serviceRequestProposal.types";
import { ProposalHistoryDetailContent } from "./ProposalHistoryDetailContent";
import { ProposalDetailsDialogSkeleton } from "./proposalDialogSkeletons";
import { ServiceRequestProposalSummaryCard } from "./ServiceRequestProposalSummaryCard";

export type ProposalDetailsContent =
  | ProposalDetailView
  | ProviderProposalHistoryItem;

export interface ProposalDetailsDialogProps {
  open?: boolean;
  onOpenChange: (open: boolean) => void;
  proposal?: ProposalDetailsContent | null;
  summary?: ServiceRequestProposalSummary | null;
  canEdit?: boolean;
  onEdit?: () => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  copyVariant?: ProposalCopyVariant;
  detailAudience?: ProposalDetailAudience;
}

export function ProposalDetailsDialog({
  open,
  onOpenChange,
  proposal,
  summary,
  canEdit = false,
  onEdit,
  isLoading = false,
  isError = false,
  onRetry,
  copyVariant = "proposal",
  detailAudience,
}: ProposalDetailsDialogProps) {
  const copy = PROPOSAL_COPY_VARIANTS[copyVariant];
  const isOpen = open ?? Boolean(proposal ?? summary);
  const showSummary = Boolean(summary);
  const { contentRef } = useMobileDialogViewport(isOpen);
  const { urls: photoUrls, isLoading: isPhotosLoading } = useProposalPhotoUrls(
    proposal?.photos ?? null,
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <ShellDialogContent ref={contentRef}>
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-0 text-left sm:border-b-0 sm:px-0 sm:pt-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="min-w-0 flex-1 text-base sm:text-lg">
              {copy.detailsTitle}
            </DialogTitle>
            <div className="flex shrink-0 items-center gap-2">
              {canEdit && onEdit ? (
                <Button type="button" size="sm" variant="outline" onClick={onEdit}>
                  {copy.editAction}
                </Button>
              ) : null}
              <DialogClose asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-0 sm:py-0">
          {isLoading ? (
            <ProposalDetailsDialogSkeleton
              showProviderPricing={showSummary || copyVariant === "budget"}
            />
          ) : null}

          {isError ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">{copy.loadingDetails}</p>
              {onRetry ? (
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  Tentar novamente
                </Button>
              ) : null}
            </div>
          ) : null}

          {showSummary && summary && !isLoading && !isError ? (
            <ServiceRequestProposalSummaryCard
              summary={summary}
              canEdit={false}
              onEdit={onEdit ?? (() => {})}
              copyVariant={copyVariant}
              variant="embedded"
            />
          ) : null}

          {proposal && !showSummary ? (
            <ProposalHistoryDetailContent
              proposal={proposal}
              copyVariant={copyVariant}
              photoUrls={photoUrls}
              isPhotosLoading={isPhotosLoading}
              detailAudience={detailAudience}
            />
          ) : null}
        </div>
      </ShellDialogContent>
    </Dialog>
  );
}
