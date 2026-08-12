import { ClientPaymentHistoryList } from "./ClientPaymentHistoryList";
import { ProviderPaymentHistoryList } from "./ProviderPaymentHistoryList";

export type PaymentHistoryRole = "client" | "provider";

export type PaymentHistorySectionProps = {
  role: PaymentHistoryRole;
  receivedFrom?: string | null;
  receivedTo?: string | null;
};

export function PaymentHistorySection({
  role,
  receivedFrom,
  receivedTo,
}: PaymentHistorySectionProps) {
  if (role === "provider") {
    return <ProviderPaymentHistoryList receivedFrom={receivedFrom} receivedTo={receivedTo} />;
  }

  return <ClientPaymentHistoryList />;
}
