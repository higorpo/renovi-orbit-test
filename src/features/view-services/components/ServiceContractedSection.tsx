import { Calendar, CircleCheck, User } from "lucide-react";
import {
  PaymentDisputeStatus,
  ProviderSettlementStatus,
} from "@/features/payments";
import type { ContractedServiceSummary } from "../types/service.types";
import { getContractedServiceStatusLabel } from "../utils/contractedServiceStatusLabel";
import { formatScheduledSummaryLabel } from "../utils/formatScheduledSummary";
import { ServiceDetailSection } from "./ServiceDetailSection";

interface ServiceContractedSectionProps {
  contracted: ContractedServiceSummary;
  showProviderSettlement?: boolean;
}

/** Read-only contracted summary. Action CTAs live in ServiceDetailActionsBar. */
export function ServiceContractedSection({
  contracted,
  showProviderSettlement = false,
}: ServiceContractedSectionProps) {
  const providerName = contracted.provider?.displayName;
  const statusLabel = getContractedServiceStatusLabel(contracted.status);
  const scheduledLabel = formatScheduledSummaryLabel(contracted);

  return (
    <ServiceDetailSection
      title="Serviço contratado"
      className="border-primary/15 bg-primary-soft/50 shadow-none"
    >
      <div className="mb-2.5 empty:hidden">
        <PaymentDisputeStatus contractedServiceId={contracted.id} />
      </div>
      <div className="space-y-2.5 text-caption text-body">
        {providerName ? (
          <p className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              Profissional: <span className="font-medium text-ink">{providerName}</span>
            </span>
          </p>
        ) : null}
        <p className="flex items-center gap-2">
          <CircleCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            Status: <span className="font-medium text-ink">{statusLabel}</span>
          </span>
        </p>
        {scheduledLabel ? (
          <p className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>Agendado para {scheduledLabel}</span>
          </p>
        ) : null}
        {contracted.farRecapturePending ? (
          <p className="text-muted-foreground" data-testid="far-recapture-pending-notice">
            Estamos reajustando a cobrança para a nova data. Isso pode levar alguns minutos.
          </p>
        ) : null}
      </div>
      {showProviderSettlement ? (
        <div className="pt-2 empty:hidden">
          <ProviderSettlementStatus
            contractedServiceId={contracted.id}
            contractedServiceStatus={contracted.status}
          />
        </div>
      ) : null}
    </ServiceDetailSection>
  );
}
