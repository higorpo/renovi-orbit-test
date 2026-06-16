import { CircleDollarSign, FileText } from "lucide-react";
import { isPendingProposalStatus } from "../utils/proposalStatus";
import { ProposalCountdownBanner } from "./ProposalCountdownBanner";
import { ProposalSuggestedSlotsList } from "./ProposalSuggestedSlotsList";
import { ProposalPhotosGrid } from "./ProposalPhotosGrid";
import { useProposalPhotoUrls } from "../hooks/useProposalPhotoUrls";
import { formatCurrency } from "@/lib/formatCurrency";
import type { ServiceRequestBudgetCompareProposal } from "../types/serviceRequestBudgetCompare.types";
import { ServiceRequestBudgetStatusBadge } from "./ServiceRequestBudgetStatusBadge";

interface ServiceRequestBudgetCompareVersionBlockProps {
  proposal: ServiceRequestBudgetCompareProposal;
}

export function ServiceRequestBudgetCompareVersionBlock({
  proposal,
}: ServiceRequestBudgetCompareVersionBlockProps) {
  const { urls, isLoading } = useProposalPhotoUrls(
    proposal.photos?.length ? proposal.photos : null,
  );

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-3.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Proposta atual
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Leia o escopo antes de comparar valores entre profissionais.
          </p>
        </div>
        <ServiceRequestBudgetStatusBadge
          status={proposal.status}
          className="w-fit shrink-0 self-start"
        />
      </div>

      {isPendingProposalStatus(proposal.status) ? (
        <ProposalCountdownBanner
          status={proposal.status}
          submittedAt={proposal.submitted_at ?? proposal.created_at}
          audience="client"
          copyVariant="budget"
          density="compact"
        />
      ) : null}

      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <FileText className="h-3.5 w-3.5" aria-hidden />
          Descrição do orçamento
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {proposal.proposal_description}
        </p>
      </div>

      <ProposalSuggestedSlotsList slots={proposal.proposal_suggested_slots} />

      <ProposalPhotosGrid
        isLoading={isLoading}
        urls={urls}
        fallbackPhotos={proposal.photos}
        heading="Fotos do orçamento"
        photoAltPrefix="Foto do orçamento"
      />

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <CircleDollarSign className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Valor proposto</p>
            <p className="text-sm font-semibold text-foreground">
              {formatCurrency(proposal.proposed_amount)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
