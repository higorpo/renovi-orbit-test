import { PaymentHistorySection } from "@/features/payments";
import { AccountRoleGate } from "../AccountRoleGate";
import { AccountSectionHeader } from "../AccountSectionHeader";

export function ProviderReceivablesPage() {
  return (
    <AccountRoleGate allow={["provider"]}>
      <div className="space-y-6 px-4 py-6 md:px-0 md:py-0">
        <AccountSectionHeader
          title="Recebimentos"
          description="Valores capturados na plataforma (antes da liquidação bancária)"
        />
        <PaymentHistorySection role="provider" />
      </div>
    </AccountRoleGate>
  );
}
