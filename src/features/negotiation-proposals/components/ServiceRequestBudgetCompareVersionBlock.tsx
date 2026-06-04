import { FileText } from "lucide-react";
import { isPendingProposalStatus } from "../utils/proposalStatus";
import { ProposalCountdownBanner } from "./ProposalCountdownBanner";
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
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Versão atual
      </p>
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-base font-semibold">{formatCurrency(proposal.proposed_amount)}</p>
          <ServiceRequestBudgetStatusBadge status={proposal.status} />
        </div>

        {isPendingProposalStatus(proposal.status) ? (
          <ProposalCountdownBanner
            status={proposal.status}
            submittedAt={proposal.submitted_at ?? proposal.created_at}
            audience="client"
            copyVariant="budget"
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

        <ProposalPhotosGrid
          isLoading={isLoading}
          urls={urls}
          fallbackPhotos={proposal.photos}
          heading="Fotos do orçamento"
          photoAltPrefix="Foto do orçamento"
        />
      </div>
    </div>
  );
}
