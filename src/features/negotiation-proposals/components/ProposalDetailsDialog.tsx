import { Loader2, MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMobileDialogViewport } from "@/hooks/useMobileDialogViewport";
import { formatCurrency } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";
import { PROPOSAL_COPY_VARIANTS, type ProposalCopyVariant } from "../constants/proposalCopyVariants";
import { useProposalPhotoUrls } from "../hooks/useProposalPhotoUrls";
import type { ProposalDetailView } from "../types/proposalDetails.types";
import type { ProviderProposalHistoryItem } from "../types/proposals.types";
import {
  formatProposalDateOnly,
  formatProposalDateTime,
  getProposalStatusLabel,
  translateProposalShift,
} from "../utils/proposalDetailsFormatters";
import { isRejectedProposalStatus } from "../utils/proposalStatus";
import { ProposalPhotosGrid } from "./ProposalPhotosGrid";

export type ProposalDetailsContent =
  | ProposalDetailView
  | ProviderProposalHistoryItem;

export interface ProposalDetailsDialogProps {
  open?: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: ProposalDetailsContent | null | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  copyVariant?: ProposalCopyVariant;
}

export function ProposalDetailsDialog({
  open,
  onOpenChange,
  proposal,
  isLoading = false,
  isError = false,
  onRetry,
  copyVariant = "proposal",
}: ProposalDetailsDialogProps) {
  const copy = PROPOSAL_COPY_VARIANTS[copyVariant];
  const isOpen = open ?? Boolean(proposal);
  const { contentRef } = useMobileDialogViewport(isOpen);
  const { urls: photoUrls, isLoading: isPhotosLoading } = useProposalPhotoUrls(
    proposal?.photos ?? null,
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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

          {proposal ? (
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
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Taxa da plataforma</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatCurrency(proposal.tax_amount)} ({(proposal.tax_rate * 100).toFixed(0)}%)
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Valor a receber</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatCurrency(proposal.final_amount)}
                  </p>
                </div>
              </div>

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

              {isRejectedProposalStatus(proposal.status) &&
              proposal.client_rejection_response?.trim() ? (
                <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <MessageSquareQuote className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Resposta do cliente sobre a rejeição
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {proposal.client_rejection_response.trim()}
                  </p>
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
      </DialogContent>
    </Dialog>
  );
}
