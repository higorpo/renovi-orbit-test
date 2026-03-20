import { MessageSquareQuote } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ProviderProposalHistoryItem } from "../api/providerProposals.api";
import { useProviderProposalPhotoUrls } from "../hooks/useProviderProposalPhotoUrls";
import { ProviderProposalPhotosGrid } from "./ProviderProposalPhotosGrid";
import {
  formatProposalCurrency,
  formatProposalDateTime,
  translateProposalStatus,
} from "./providerProposalFormatters";

interface ProviderProposalDetailsDialogProps {
  proposal: ProviderProposalHistoryItem | null;
  onOpenChange: (open: boolean) => void;
}

export function ProviderProposalDetailsDialog({
  proposal,
  onOpenChange,
}: ProviderProposalDetailsDialogProps) {
  const { urls: photoUrls, isLoading } = useProviderProposalPhotoUrls(proposal?.photos ?? null);

  return (
    <Dialog open={Boolean(proposal)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Detalhes da proposta</DialogTitle>
        </DialogHeader>

        {proposal && (
          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Valor cobrado</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatProposalCurrency(proposal.proposed_amount)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {translateProposalStatus(proposal.status)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Taxa da plataforma</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatProposalCurrency(proposal.tax_amount)} ({(proposal.tax_rate * 100).toFixed(0)}
                  %)
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Valor a receber</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatProposalCurrency(proposal.final_amount)}
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Descrição</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {proposal.proposal_description}
              </p>
            </div>

            {(proposal.status ?? "").toLowerCase() === "rejected" &&
              proposal.client_rejection_response?.trim() && (
                <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <MessageSquareQuote className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Resposta do cliente sobre a rejeição
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {proposal.client_rejection_response.trim()}
                  </p>
                </div>
              )}

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Criada em</p>
                <p className="mt-1 text-sm text-foreground">
                  {formatProposalDateTime(proposal.created_at)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Última edição</p>
                <p className="mt-1 text-sm text-foreground">
                  {formatProposalDateTime(proposal.updated_at)}
                </p>
              </div>
            </div>

            <ProviderProposalPhotosGrid
              isLoading={isLoading}
              urls={photoUrls}
              fallbackPhotos={proposal.photos}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
