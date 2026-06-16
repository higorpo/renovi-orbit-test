import { useState } from "react";
import { CircleDollarSign, FileText, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatCurrency";
import { PROPOSAL_COPY_VARIANTS, type ProposalCopyVariant } from "../constants/proposalCopyVariants";
import {
  getProposalSummaryHeadingClassName,
  type ProposalSummaryHeadingSize,
} from "../constants/proposalSummaryHeading";
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
import {
  ProposalDetailLabel,
  ProposalDetailSection,
  ProposalDetailValue,
} from "./proposalDetailLayout";

export interface ServiceRequestProposalSummaryCardProps {
  summary: ServiceRequestProposalSummary;
  canEdit: boolean;
  onEdit: () => void;
  copyVariant?: ProposalCopyVariant;
  variant?: "card" | "embedded";
  headingSize?: ProposalSummaryHeadingSize;
}

function ServiceRequestProposalSummaryContent({
  summary,
  copyVariant = "budget",
  headingSize = "card",
}: {
  summary: ServiceRequestProposalSummary;
  copyVariant?: ProposalCopyVariant;
  headingSize?: ProposalSummaryHeadingSize;
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
          <ProposalDetailSection variant="muted">
            <ProposalDetailLabel icon={CircleDollarSign}>
              {copy.amountInformedLabel}
            </ProposalDetailLabel>
            <ProposalDetailValue semibold>
              {formatCurrency(summary.proposedAmount)}
            </ProposalDetailValue>
          </ProposalDetailSection>
        )}

        {typeof summary.taxAmount === "number" && (
          <ProposalDetailSection variant="muted">
            <ProposalDetailLabel icon={Percent}>Taxa da plataforma</ProposalDetailLabel>
            <ProposalDetailValue semibold>
              {formatCurrency(summary.taxAmount)}
              {typeof summary.taxRate === "number"
                ? ` (${(summary.taxRate * 100).toFixed(0)}%)`
                : ""}
            </ProposalDetailValue>
          </ProposalDetailSection>
        )}
      </div>

      <ProposalDetailSection variant="muted">
        <ProposalDetailLabel>{copy.statusLabel}</ProposalDetailLabel>
        <ProposalDetailValue semibold>{proposalStatus}</ProposalDetailValue>
      </ProposalDetailSection>

      {summary.description ? (
        <ProposalDetailSection>
          <ProposalDetailLabel icon={FileText} emphasized>
            {copy.descriptionLabel}
          </ProposalDetailLabel>
          <ProposalDetailValue spacing="relaxed" className="whitespace-pre-wrap">
            {summary.description}
          </ProposalDetailValue>
        </ProposalDetailSection>
      ) : null}

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
        headingSize={headingSize}
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
        detailAudience="provider"
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
  headingSize = "card",
}: ServiceRequestProposalSummaryCardProps) {
  const copy = PROPOSAL_COPY_VARIANTS[copyVariant];
  const summaryTitle = summary.isLatestProposal
    ? copy.summaryLatestTitle
    : copy.summaryDetailsTitle;

  if (variant === "embedded") {
    return (
      <div className="space-y-4">
        <ServiceRequestProposalSummaryContent
          summary={summary}
          copyVariant={copyVariant}
          headingSize={headingSize}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className={getProposalSummaryHeadingClassName(headingSize, "w-full sm:w-auto")}>
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
        <ServiceRequestProposalSummaryContent
          summary={summary}
          copyVariant={copyVariant}
          headingSize={headingSize}
        />
      </CardContent>
    </Card>
  );
}
