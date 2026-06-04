import { useState } from "react";
import { CircleDollarSign, FileText, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatCurrency";
import { PROPOSAL_COPY_VARIANTS, type ProposalCopyVariant } from "../constants/proposalCopyVariants";
import { useProposalHistory } from "../hooks/useProposalHistory";
import { useProposalPhotoUrls } from "../hooks/useProposalPhotoUrls";
import type { ProviderProposalHistoryItem } from "../types/proposals.types";
import type { ServiceRequestProposalSummary } from "../types/serviceRequestProposal.types";
import { getProposalStatusLabel } from "../utils/proposalDetailsFormatters";
import { isRejectedProposalStatus } from "../utils/proposalStatus";
import { ProposalDetailsDialog } from "./ProposalDetailsDialog";
import { ProposalHistoryAccordion } from "./ProposalHistoryAccordion";
import { ProposalPhotosGrid } from "./ProposalPhotosGrid";
import { ProposalClientRejectionNotice } from "./ProposalClientRejectionNotice";
import { ProposalRevisionRequestNotice } from "./ProposalRevisionRequestNotice";

export interface ServiceRequestProposalSummaryCardProps {
  summary: ServiceRequestProposalSummary;
  canEdit: boolean;
  onEdit: () => void;
  copyVariant?: ProposalCopyVariant;
  variant?: "card" | "embedded";
}

function ServiceRequestProposalSummaryContent({
  summary,
  copyVariant = "budget",
}: {
  summary: ServiceRequestProposalSummary;
  copyVariant?: ProposalCopyVariant;
}) {
  const copy = PROPOSAL_COPY_VARIANTS[copyVariant];
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] =
    useState<ProviderProposalHistoryItem | null>(null);
  const { urls, isLoading } = useProposalPhotoUrls(summary.photos);
  const {
    items: proposalHistory,
    isLoading: isHistoryLoading,
    isError: isHistoryError,
  } = useProposalHistory(summary.serviceRequestId, historyOpen);

  const proposalStatus = getProposalStatusLabel(summary.status);

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {typeof summary.proposedAmount === "number" && (
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CircleDollarSign className="h-3.5 w-3.5" aria-hidden />
              {copy.amountInformedLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatCurrency(summary.proposedAmount)}
            </p>
          </div>
        )}

        {typeof summary.taxAmount === "number" && (
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Percent className="h-3.5 w-3.5" aria-hidden />
              Taxa da plataforma
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatCurrency(summary.taxAmount)}
              {typeof summary.taxRate === "number"
                ? ` (${(summary.taxRate * 100).toFixed(0)}%)`
                : ""}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">{copy.statusLabel}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{proposalStatus}</p>
      </div>

      {summary.description && (
        <div className="rounded-lg border p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
            <FileText className="h-3.5 w-3.5" aria-hidden />
            {copy.descriptionLabel}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{summary.description}</p>
        </div>
      )}

      {isRejectedProposalStatus(summary.status) ? (
        <ProposalClientRejectionNotice
          clientRejectionResponse={summary.clientRejectionResponse}
        />
      ) : null}
      
      <ProposalRevisionRequestNotice
        revisionReason={summary.revisionReason}
        revisionNotes={summary.revisionNotes}
      />

      <ProposalPhotosGrid
        isLoading={isLoading}
        urls={urls}
        fallbackPhotos={summary.photos}
        heading={copy.photosHeading}
        photoAltPrefix={copy.photoAltPrefix}
      />

      <ProposalHistoryAccordion
        copyVariant={copyVariant}
        historyOpen={historyOpen}
        proposalHistory={proposalHistory}
        isHistoryLoading={isHistoryLoading}
        isHistoryError={isHistoryError}
        onHistoryOpenChange={setHistoryOpen}
        onProposalSelect={setSelectedProposal}
      />

      <ProposalDetailsDialog
        proposal={selectedProposal}
        onOpenChange={(open) => {
          if (!open) setSelectedProposal(null);
        }}
        copyVariant={copyVariant}
      />
    </>
  );
}

export function ServiceRequestProposalSummaryCard({
  summary,
  canEdit,
  onEdit,
  copyVariant = "budget",
  variant = "card",
}: ServiceRequestProposalSummaryCardProps) {
  const copy = PROPOSAL_COPY_VARIANTS[copyVariant];
  const summaryTitle = summary.isLatestProposal
    ? copy.summaryLatestTitle
    : copy.summaryDetailsTitle;

  if (variant === "embedded") {
    return (
      <div className="space-y-4">
        <ServiceRequestProposalSummaryContent summary={summary} copyVariant={copyVariant} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="w-full text-base font-semibold leading-tight text-foreground sm:w-auto">
            {summaryTitle}
          </h3>
          {canEdit && (
            <Button type="button" size="sm" variant="outline" onClick={onEdit} className="w-full sm:w-auto">
              {copy.editAction}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 !pt-0">
        <ServiceRequestProposalSummaryContent summary={summary} copyVariant={copyVariant} />
      </CardContent>
    </Card>
  );
}
