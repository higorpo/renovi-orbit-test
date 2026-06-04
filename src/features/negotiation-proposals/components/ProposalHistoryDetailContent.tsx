import {
  CalendarDays,
  CircleDollarSign,
  Clock,
  FileText,
  Percent,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import { PROPOSAL_COPY_VARIANTS, type ProposalCopyVariant } from "../constants/proposalCopyVariants";
import type { ProposalDetailAudience } from "../types/proposalDetails.types";
import type { ProposalDetailView } from "../types/proposalDetails.types";
import type { ProviderProposalHistoryItem } from "../types/proposals.types";
import {
  formatProposalDateOnly,
  getProposalStatusLabel,
  translateProposalShift,
} from "../utils/proposalDetailsFormatters";
import { isRejectedProposalStatus } from "../utils/proposalStatus";
import { ProposalClientRejectionNotice } from "./ProposalClientRejectionNotice";
import { ProposalCountdownBanner } from "./ProposalCountdownBanner";
import { ProposalPhotosGrid } from "./ProposalPhotosGrid";
import { ProposalRevisionRequestNotice } from "./ProposalRevisionRequestNotice";
import {
  ProposalDetailLabel,
  ProposalDetailSection,
  ProposalDetailValue,
} from "./proposalDetailLayout";

type ProposalDetailsContent = ProposalDetailView | ProviderProposalHistoryItem;

function getProposalCountdownFields(proposal: ProposalDetailsContent) {
  if ("submitted_at" in proposal) {
    return {
      submittedAt: proposal.submitted_at,
      clientResponseDeadlineAt: proposal.client_response_deadline_at,
    };
  }

  return {
    submittedAt: null,
    clientResponseDeadlineAt: null,
  };
}

function proposalHasProviderPricing(
  proposal: ProposalDetailsContent,
): proposal is ProposalDetailsContent & {
  tax_rate: number;
  tax_amount: number;
  final_amount: number;
} {
  return (
    typeof (proposal as { tax_rate?: number }).tax_rate === "number" &&
    typeof (proposal as { tax_amount?: number }).tax_amount === "number" &&
    typeof (proposal as { final_amount?: number }).final_amount === "number"
  );
}

function formatProposalDuration(
  value: number,
  unit: string | null,
): string {
  if (unit === "days") {
    return `${value} ${value === 1 ? "dia" : "dias"}`;
  }
  return `${value} ${value === 1 ? "hora" : "horas"}`;
}

export interface ProposalHistoryDetailContentProps {
  proposal: ProposalDetailsContent;
  copyVariant: ProposalCopyVariant;
  photoUrls: string[];
  isPhotosLoading: boolean;
  detailAudience?: ProposalDetailAudience;
}

export function ProposalHistoryDetailContent({
  proposal,
  copyVariant,
  photoUrls,
  isPhotosLoading,
  detailAudience,
}: ProposalHistoryDetailContentProps) {
  const copy = PROPOSAL_COPY_VARIANTS[copyVariant];
  const providerPricing = proposalHasProviderPricing(proposal) ? proposal : null;
  const amountLabel = providerPricing ? copy.amountInformedLabel : copy.amountLabel;
  const proposalStatus = getProposalStatusLabel(proposal.status);
  const countdownFields = getProposalCountdownFields(proposal);

  const statusSection = (
    <ProposalDetailSection variant="muted">
      <ProposalDetailLabel>{copy.statusLabel}</ProposalDetailLabel>
      <ProposalDetailValue semibold>{proposalStatus}</ProposalDetailValue>
    </ProposalDetailSection>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-2">
        <ProposalDetailSection variant="muted">
          <ProposalDetailLabel icon={CircleDollarSign}>{amountLabel}</ProposalDetailLabel>
          <ProposalDetailValue semibold>
            {formatCurrency(proposal.proposed_amount)}
          </ProposalDetailValue>
        </ProposalDetailSection>

        {providerPricing ? (
          <ProposalDetailSection variant="muted">
            <ProposalDetailLabel icon={Percent}>Taxa da plataforma</ProposalDetailLabel>
            <ProposalDetailValue semibold>
              {formatCurrency(providerPricing.tax_amount)} (
              {(providerPricing.tax_rate * 100).toFixed(0)}%)
            </ProposalDetailValue>
          </ProposalDetailSection>
        ) : (
          statusSection
        )}
      </div>

      {providerPricing ? (
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-2">
          <ProposalDetailSection variant="muted">
            <ProposalDetailLabel icon={Wallet}>Valor a receber</ProposalDetailLabel>
            <ProposalDetailValue semibold>
              {formatCurrency(providerPricing.final_amount)}
            </ProposalDetailValue>
          </ProposalDetailSection>
          {statusSection}
        </div>
      ) : null}

      {detailAudience ? (
        <ProposalCountdownBanner
          status={proposal.status}
          submittedAt={countdownFields.submittedAt}
          clientResponseDeadlineAt={countdownFields.clientResponseDeadlineAt}
          audience={detailAudience}
          copyVariant={copyVariant}
        />
      ) : null}

      {proposal.proposal_description ? (
        <ProposalDetailSection>
          <ProposalDetailLabel icon={FileText} emphasized>
            {copy.descriptionLabel}
          </ProposalDetailLabel>
          <ProposalDetailValue spacing="relaxed" className="whitespace-pre-wrap">
            {proposal.proposal_description}
          </ProposalDetailValue>
        </ProposalDetailSection>
      ) : null}

      {proposal.proposal_duration_value ? (
        <ProposalDetailSection variant="muted">
          <ProposalDetailLabel icon={Clock}>Prazo estimado</ProposalDetailLabel>
          <ProposalDetailValue semibold>
            {formatProposalDuration(
              proposal.proposal_duration_value,
              proposal.proposal_duration_unit,
            )}
          </ProposalDetailValue>
        </ProposalDetailSection>
      ) : null}

      {proposal.proposal_suggested_slots.length > 0 ? (
        <ProposalDetailSection>
          <ProposalDetailLabel icon={CalendarDays}>
            Datas sugeridas para execução
          </ProposalDetailLabel>
          <ul className="mt-2 space-y-2">
            {proposal.proposal_suggested_slots.map((slot, index) => (
              <li
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
              </li>
            ))}
          </ul>
        </ProposalDetailSection>
      ) : null}

      <ProposalRevisionRequestNotice
        revisionReason={proposal.revision_reason}
        revisionNotes={proposal.revision_notes}
      />

      {isRejectedProposalStatus(proposal.status) ? (
        <ProposalClientRejectionNotice
          clientRejectionResponse={proposal.client_rejection_response}
        />
      ) : null}

      <ProposalPhotosGrid
        isLoading={isPhotosLoading}
        urls={photoUrls}
        fallbackPhotos={proposal.photos}
        heading={copy.photosHeading}
        photoAltPrefix={copy.photoAltPrefix}
      />
    </div>
  );
}
