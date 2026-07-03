import { usePaymentSchedule } from "../hooks/usePaymentSchedule";
import { ProviderSettlementDisclosure } from "./ProviderSettlementDisclosure";

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

  return (
    <ProviderSettlementDisclosure
      capturePaidAt={schedule.paidAt}
      showCompletionNote={showCompletionNote}
      className={className}
    />
  );
}
