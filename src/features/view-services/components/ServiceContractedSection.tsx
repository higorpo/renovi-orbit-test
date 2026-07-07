import { Calendar, CircleCheck, User } from "lucide-react";
import {
  ContractedServiceCancelAction,
  ManualPaymentRecovery,
  PaymentDisputeStatus,
  ProviderSettlementStatus,
  type CancellationViewerRole,
} from "@/features/payments";
import {
  ServiceCompletionActions,
  type ServiceCompletionViewerRole,
} from "./ServiceCompletionActions";
import type { ContractedServiceSummary } from "../types/service.types";
import { formatShift } from "../utils/formatShift";
import { ServiceDetailSection } from "./ServiceDetailSection";

interface ServiceContractedSectionProps {
  contracted: ContractedServiceSummary;
  serviceRequestId?: string;
  showManualPayment?: boolean;
  showServiceCompletion?: boolean;
  completionViewerRole?: ServiceCompletionViewerRole;
  showProviderSettlement?: boolean;
  showServiceCancellation?: boolean;
  cancellationViewerRole?: CancellationViewerRole;
  onCancellationSuccess?: () => void;
  onCompletionSuccess?: () => void;
}

export function ServiceContractedSection({
  contracted,
  serviceRequestId,
  showManualPayment = false,
  showServiceCompletion = false,
  completionViewerRole,
  showProviderSettlement = false,
  showServiceCancellation = false,
  cancellationViewerRole,
  onCancellationSuccess,
  onCompletionSuccess,
}: ServiceContractedSectionProps) {
  const providerName = contracted.provider?.displayName;

  return (
    <ServiceDetailSection
      title="Serviço contratado"
      className="border-primary/15 bg-primary-soft/50 shadow-none"
    >
      <div className="mb-2.5">
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
            Status: <span className="font-medium text-ink">{contracted.status}</span>
          </span>
        </p>
        {contracted.scheduledStartDate ? (
          <p className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              Agendado para {contracted.scheduledStartDate}
              {contracted.scheduledEndDate ? ` até ${contracted.scheduledEndDate}` : ""}
              {contracted.scheduledShift ? ` (${formatShift(contracted.scheduledShift)})` : ""}
            </span>
          </p>
        ) : null}
      </div>
      {showProviderSettlement ? (
        <div className="pt-2">
          <ProviderSettlementStatus contractedServiceId={contracted.id} />
        </div>
      ) : null}
      {showManualPayment && serviceRequestId ? (
        <div className="pt-3">
          <ManualPaymentRecovery
            contractedServiceId={contracted.id}
            serviceRequestId={serviceRequestId}
          />
        </div>
      ) : null}
      {showServiceCompletion && completionViewerRole ? (
        <div className="pt-3">
          <ServiceCompletionActions
            contractedServiceId={contracted.id}
            status={contracted.status}
            viewerRole={completionViewerRole}
            onSuccess={onCompletionSuccess}
          />
        </div>
      ) : null}
      {showServiceCancellation && cancellationViewerRole ? (
        <div className="pt-3">
          <ContractedServiceCancelAction
            contractedServiceId={contracted.id}
            serviceStatus={contracted.status}
            scheduledStartDate={contracted.scheduledStartDate ?? ""}
            scheduledShift={contracted.scheduledShift ?? "morning"}
            viewerRole={cancellationViewerRole}
            onSuccess={onCancellationSuccess}
          />
        </div>
      ) : null}
    </ServiceDetailSection>
  );
}
