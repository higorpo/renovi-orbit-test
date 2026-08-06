import { Calendar, CircleCheck, User } from "lucide-react";
import {
  ContractedServiceCancelAction,
  ManualPaymentRecovery,
  PaymentDisputeStatus,
  ProviderSettlementStatus,
  type CancellationViewerRole,
} from "@/features/payments";
import { ContractedServiceRescheduleAction } from "@/features/service-reschedule";
import {
  ClientEvaluateServiceAction,
  ProviderMarkExecutedAction,
} from "@/features/service-completion";
import { useAuth } from "@/features/auth";
import type { ContractedServiceSummary } from "../types/service.types";
import { getContractedServiceStatusLabel } from "../utils/contractedServiceStatusLabel";
import { formatScheduledSummaryLabel } from "../utils/formatScheduledSummary";
import { ServiceDetailSection } from "./ServiceDetailSection";

interface ServiceContractedSectionProps {
  contracted: ContractedServiceSummary;
  serviceRequestId?: string;
  /** From get_service; gates provider mark-executed without fetching completion context. */
  enrichmentReady?: boolean;
  showManualPayment?: boolean;
  showProviderSettlement?: boolean;
  showServiceCancellation?: boolean;
  cancellationViewerRole?: CancellationViewerRole;
  onCancellationSuccess?: () => void;
  onRescheduleSuccess?: () => void;
  onCompletionSuccess?: () => void;
}

export function ServiceContractedSection({
  contracted,
  serviceRequestId,
  enrichmentReady = false,
  showManualPayment = false,
  showProviderSettlement = false,
  showServiceCancellation = false,
  cancellationViewerRole,
  onCancellationSuccess,
  onRescheduleSuccess,
  onCompletionSuccess,
}: ServiceContractedSectionProps) {
  const { profile } = useAuth();
  const providerName = contracted.provider?.displayName;
  const statusLabel = getContractedServiceStatusLabel(contracted.status);
  const scheduledLabel = formatScheduledSummaryLabel(contracted);
  const isProvider = profile?.role === "provider";
  const isClient = profile?.role === "client";

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
          <ProviderSettlementStatus contractedServiceId={contracted.id} />
        </div>
      ) : null}
      <div
        className="flex flex-col gap-2 pt-2.5 sm:flex-row sm:flex-wrap empty:hidden"
        data-testid="contracted-service-actions"
      >
        {isProvider && serviceRequestId ? (
          <ProviderMarkExecutedAction
            serviceRequestId={serviceRequestId}
            contractedStatus={contracted.status}
            enrichmentReady={enrichmentReady}
            scheduledStartDate={contracted.scheduledStartDate}
            scheduledEndDate={contracted.scheduledEndDate}
            onExecuted={onCompletionSuccess}
          />
        ) : null}
        {isClient && serviceRequestId ? (
          <ClientEvaluateServiceAction
            serviceRequestId={serviceRequestId}
            contractedStatus={contracted.status}
            onCompleted={onCompletionSuccess}
          />
        ) : null}
        {showManualPayment && serviceRequestId ? (
          <ManualPaymentRecovery
            contractedServiceId={contracted.id}
            serviceRequestId={serviceRequestId}
          />
        ) : null}
        {showServiceCancellation && cancellationViewerRole ? (
          <ContractedServiceCancelAction
            contractedServiceId={contracted.id}
            serviceStatus={contracted.status}
            scheduledStartDate={contracted.scheduledStartDate ?? ""}
            scheduledShift={contracted.scheduledShift ?? "morning"}
            viewerRole={cancellationViewerRole}
            onSuccess={onCancellationSuccess}
          />
        ) : null}
        {profile?.role === "client" || profile?.role === "provider" ? (
          <ContractedServiceRescheduleAction
            contractedServiceId={contracted.id}
            chatId={contracted.chatId}
            viewerRole={profile.role}
            reschedule={contracted.reschedule}
            onSuccess={onRescheduleSuccess}
          />
        ) : null}
      </div>
    </ServiceDetailSection>
  );
}
