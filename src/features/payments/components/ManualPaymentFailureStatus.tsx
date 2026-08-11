import { usePaymentSchedule } from "../hooks/usePaymentSchedule";
import { ManualPaymentFailureAlert } from "./ManualPaymentFailureAlert";

export type ManualPaymentFailureStatusProps = {
  contractedServiceId: string;
  className?: string;
};

/** Loads payment schedule and shows the failure alert when eligible. */
export function ManualPaymentFailureStatus({
  contractedServiceId,
  className,
}: ManualPaymentFailureStatusProps) {
  const { data, isLoading } = usePaymentSchedule(contractedServiceId);

  if (isLoading) return null;

  return (
    <ManualPaymentFailureAlert
      scheduleState={data?.schedule?.state}
      failureCode={data?.schedule?.failureCode}
      className={className}
    />
  );
}
