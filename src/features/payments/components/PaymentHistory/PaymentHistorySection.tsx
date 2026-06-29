import { ClientPaymentHistoryList } from "./ClientPaymentHistoryList";
import { ProviderPaymentHistoryList } from "./ProviderPaymentHistoryList";

export type PaymentHistoryRole = "client" | "provider";

export type PaymentHistorySectionProps = {
  role: PaymentHistoryRole;
};

export function PaymentHistorySection({ role }: PaymentHistorySectionProps) {
  if (role === "provider") {
    return <ProviderPaymentHistoryList />;
  }

  return <ClientPaymentHistoryList />;
}
