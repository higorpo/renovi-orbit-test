import {
  ProviderSettlementDisclosure,
  resolveProviderSettlementHold,
} from "@/features/provider-earnings";
import { usePaymentSchedule } from "../hooks/usePaymentSchedule";

const PAID_SCHEDULE_STATES = new Set(["PAID", "REFUNDED", "PARTIALLY_REFUNDED", "REFUND_REQUESTED"]);

export type ProviderSettlementStatusProps = {
  contractedServiceId: string;
  /** contracted_services.status — enables service_dispute hold when IN_DISPUTE. */
  contractedServiceStatus?: string | null;
  showCompletionNote?: boolean;
  className?: string;
};

export function ProviderSettlementStatus({
  contractedServiceId,
  contractedServiceStatus = null,
  showCompletionNote = true,
  className,
}: ProviderSettlementStatusProps) {
  const { data } = usePaymentSchedule(contractedServiceId);
  const schedule = data?.schedule;

  if (!schedule?.paidAt || !PAID_SCHEDULE_STATES.has(schedule.state)) {
    return null;
  }

  const { settlementOnHold, holdReason } = resolveProviderSettlementHold({
    isDisputed: schedule.isDisputed,
    scheduleState: schedule.state,
    contractedServiceStatus,
  });

  return (
    <ProviderSettlementDisclosure
      capturePaidAt={schedule.paidAt}
      showCompletionNote={showCompletionNote}
      settlementOnHold={settlementOnHold}
      holdReason={holdReason}
      className={className}
    />
  );
}
