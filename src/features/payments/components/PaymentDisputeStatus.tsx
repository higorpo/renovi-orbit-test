import { usePaymentSchedule } from "../hooks/usePaymentSchedule";
import { PaymentDisputeBadge } from "./PaymentDisputeBadge";

export type PaymentDisputeStatusProps = {
  contractedServiceId: string;
  className?: string;
};

export function PaymentDisputeStatus({
  contractedServiceId,
  className,
}: PaymentDisputeStatusProps) {
  const { data } = usePaymentSchedule(contractedServiceId);

  if (!data?.schedule?.isDisputed) {
    return null;
  }

  return <PaymentDisputeBadge className={className} />;
}
