import { ProviderSettlementDisclosure } from "@/features/provider-earnings";
import { usePaymentSchedule } from "../hooks/usePaymentSchedule";

const PAID_SCHEDULE_STATES = new Set(["PAID", "REFUNDED", "PARTIALLY_REFUNDED", "REFUND_REQUESTED"]);

export type ProviderSettlementStatusProps = {
  contractedServiceId: string;
  showCompletionNote?: boolean;
  className?: string;
};

export function ProviderSettlementStatus({
  contractedServiceId,
  showCompletionNote = true,
  className,
}: ProviderSettlementStatusProps) {
  const { data } = usePaymentSchedule(contractedServiceId);
  const schedule = data?.schedule;

  if (!schedule?.paidAt || !PAID_SCHEDULE_STATES.has(schedule.state)) {
    return null;
  }

  const settlementOnHold =
    schedule.isDisputed ||
    schedule.state === "REFUND_REQUESTED" ||
    schedule.state === "REFUNDED" ||
    schedule.state === "PARTIALLY_REFUNDED";

  const holdReason = schedule.isDisputed ? "dispute" : "refund";

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
