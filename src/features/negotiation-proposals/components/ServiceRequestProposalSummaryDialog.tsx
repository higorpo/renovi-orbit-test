import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { cn } from "@/lib/utils";
import { PROPOSAL_COPY_VARIANTS, type ProposalCopyVariant } from "../constants/proposalCopyVariants";
import type { ServiceRequestProposalSummary } from "../types/serviceRequestProposal.types";
import { ServiceRequestProposalSummaryCard } from "./ServiceRequestProposalSummaryCard";

export interface ServiceRequestProposalSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ServiceRequestProposalSummary | null;
  canEdit: boolean;
  onEdit: () => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  copyVariant?: ProposalCopyVariant;
}

export function ServiceRequestProposalSummaryDialog({
  open,
  onOpenChange,
  summary,
  canEdit,
  onEdit,
  isLoading = false,
  isError = false,
  onRetry,
  copyVariant = "budget",
}: ServiceRequestProposalSummaryDialogProps) {
  const copy = PROPOSAL_COPY_VARIANTS[copyVariant];
  const { contentRef } = useMobileDialogViewport(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className={cn(
          "flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl sm:p-6",
          "max-sm:inset-x-0 max-sm:bottom-auto max-sm:left-0 max-sm:right-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0",
        )}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 text-left sm:border-b-0 sm:px-0 sm:py-0">
          <DialogTitle>{copy.detailsTitle}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-0 sm:py-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {copy.loadingDetails}
            </div>
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

          {summary && !isLoading && !isError ? (
            <ServiceRequestProposalSummaryCard
              summary={summary}
              canEdit={canEdit}
              onEdit={onEdit}
              copyVariant={copyVariant}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
