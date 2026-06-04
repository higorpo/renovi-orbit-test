import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShellDialogContent } from "@/components/ui/shell-dialog";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { formatCurrency } from "@/lib/formatCurrency";
import { PROPOSAL_COPY_VARIANTS, type ProposalCopyVariant } from "../constants/proposalCopyVariants";
import { useProposalPhotoUrls } from "../hooks/useProposalPhotoUrls";
import type { ProposalDetailView } from "../types/proposalDetails.types";
import type { ProviderProposalHistoryItem } from "../types/proposals.types";
import type { ServiceRequestProposalSummary } from "../types/serviceRequestProposal.types";
import {
  formatProposalDateOnly,
  formatProposalDateTime,
  getProposalStatusLabel,
  translateProposalShift,
} from "../utils/proposalDetailsFormatters";
import { ProposalClientRejectionNotice } from "./ProposalClientRejectionNotice";
import { ProposalPhotosGrid } from "./ProposalPhotosGrid";
import { ProposalRevisionRequestNotice } from "./ProposalRevisionRequestNotice";
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
}

function proposalHasProviderPricing(
  proposal: ProposalDetailsContent,
): proposal is ProposalDetailsContent & {
  tax_rate: number;
  tax_amount: number;
  final_amount: number;
} {
  return (
    typeof (proposal as ProposalDetailView).tax_rate === "number" &&
    typeof (proposal as ProposalDetailView).tax_amount === "number" &&
    typeof (proposal as ProposalDetailView).final_amount === "number"
  );
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
}: ProposalDetailsDialogProps) {
  const copy = PROPOSAL_COPY_VARIANTS[copyVariant];
  const isOpen = open ?? Boolean(proposal ?? summary);
  const showSummary = Boolean(summary);
  const providerPricingProposal =
    proposal != null && proposalHasProviderPricing(proposal) ? proposal : null;
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
              {showSummary && canEdit && onEdit ? (
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
            <div className="space-y-4 pr-1">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{copy.amountLabel}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatCurrency(proposal.proposed_amount)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {getProposalStatusLabel(proposal.status)}
                  </p>
                </div>
                {providerPricingProposal ? (
                  <>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Taxa da plataforma</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatCurrency(providerPricingProposal.tax_amount)} (
                        {(providerPricingProposal.tax_rate * 100).toFixed(0)}%)
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Valor a receber</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatCurrency(providerPricingProposal.final_amount)}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>

              <ProposalRevisionRequestNotice
                revisionReason={proposal.revision_reason}
                revisionNotes={proposal.revision_notes}
              />

              <ProposalClientRejectionNotice
                clientRejectionResponse={proposal.client_rejection_response}
              />

              {proposal.proposal_description ? (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Descrição</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {proposal.proposal_description}
                  </p>
                </div>
              ) : null}

              {proposal.proposal_duration_value ? (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Prazo estimado</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {proposal.proposal_duration_value}{" "}
                    {proposal.proposal_duration_unit === "days"
                      ? proposal.proposal_duration_value === 1
                        ? "dia"
                        : "dias"
                      : proposal.proposal_duration_value === 1
                        ? "hora"
                        : "horas"}
                  </p>
                </div>
              ) : null}

              {proposal.proposal_suggested_slots.length > 0 ? (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Datas sugeridas para execução</p>
                  <div className="mt-2 space-y-2">
                    {proposal.proposal_suggested_slots.map((slot, index) => (
                      <div
                        key={`${slot.start_date}-${slot.end_date ?? "single"}-${index}`}
                        className="rounded-md border bg-muted/20 px-3 py-2"
                      >
                        <p className="text-sm font-medium text-foreground">
                          Opção {index + 1}:{" "}
                          {proposal.proposal_duration_unit === "days" && slot.end_date
                            ? `${formatProposalDateOnly(slot.start_date)} até ${formatProposalDateOnly(slot.end_date)}`
                            : formatProposalDateOnly(slot.start_date)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Turno: {translateProposalShift(slot.shift)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Criada em</p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatProposalDateTime(proposal.created_at)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{copy.updatedAtLabel}</p>
                  <p className="mt-1 text-sm text-foreground">
                    {formatProposalDateTime(proposal.updated_at)}
                  </p>
                </div>
              </div>

              <ProposalPhotosGrid
                isLoading={isPhotosLoading}
                urls={photoUrls}
                fallbackPhotos={proposal.photos}
                heading={copy.photosHeading}
                photoAltPrefix={copy.photoAltPrefix}
              />
            </div>
          ) : null}
        </div>
      </ShellDialogContent>
    </Dialog>
  );
}
